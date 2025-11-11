class MathFishGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.container = document.getElementById('gameContainer');
        this.score = 0;
        this.fishSize = 10;
        this.bubbles = [];
        this.fish = null;
        this.gameRunning = true;
        this.isPaused = false;
        this.startTime = Date.now();

        // 初始化音效和动画管理器
        this.audioManager = new AudioManager();
        this.particleManager = new ParticleManager(this.container);
        this.rippleManager = new RippleManager(this.container);

        this.init();
    }

    init() {
        this.setupCanvas();
        this.createFish();
        this.generateInitialBubbles();
        this.setupEventListeners();
        this.startGameLoop();
        this.updateUI();
    }

    setupCanvas() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.width = rect.width;
        this.height = rect.height;
    }

    createFish() {
        const fishNumber = Math.floor(Math.random() * 10) + 1;
        this.fish = {
            x: this.width / 2,
            y: this.height / 2,
            targetX: this.width / 2,
            targetY: this.height / 2,
            number: fishNumber,
            element: this.createFishElement(fishNumber),
            eatenCount: 0,
            maxEaten: 5 // 需要吃5个相同数字的泡泡才能升级
        };
        this.updateFishPosition();
    }

    createFishElement(number) {
        const fish = document.createElement('div');
        fish.className = 'fish';
        fish.innerHTML = `
            <div class="fish-body">
                <div class="fish-tail"></div>
                <div class="fish-eye"></div>
                <div class="fish-number">${number}</div>
            </div>
        `;
        this.container.appendChild(fish);
        return fish;
    }

    generateInitialBubbles() {
        // 生成初始泡泡，确保有一些可以组合成目标数字
        // 但不要生成和鱼数字相同的泡泡，避免用户不需要拖动
        const target = this.fish.number;

        // 生成一些小于目标数字的泡泡
        for (let i = 0; i < 8; i++) {
            let number;
            do {
                number = Math.floor(Math.random() * target) + 1;
            } while (number === target); // 确保不等于目标数字

            this.createBubble(null, null, number);
        }

        // 不再生成等于目标数字的泡泡，让用户必须通过合并来创造
    }

    createBubble(x, y, number) {
        const bubble = {
            id: Date.now() + Math.random(),
            x: x || Math.random() * (this.width - 100) + 50,
            y: y || Math.random() * (this.height - 100) + 50,
            number: number || Math.floor(Math.random() * 10) + 1,
            radius: 30,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            element: null,
            isDragging: false
        };

        bubble.element = this.createBubbleElement(bubble);
        this.bubbles.push(bubble);
        return bubble;
    }

    createBubbleElement(bubble) {
        const element = document.createElement('div');
        element.className = 'bubble floating';
        element.dataset.id = bubble.id;
        element.style.width = `${bubble.radius * 2}px`;
        element.style.height = `${bubble.radius * 2}px`;
        element.style.left = `${bubble.x - bubble.radius}px`;
        element.style.top = `${bubble.y - bubble.radius}px`;
        element.style.fontSize = `${Math.max(14, bubble.radius / 3)}px`;
        element.textContent = bubble.number;

        this.container.appendChild(element);
        return element;
    }

    setupEventListeners() {
        // 鼠标事件
        this.container.addEventListener('mousedown', this.handleStart.bind(this));
        this.container.addEventListener('mousemove', this.handleMove.bind(this));
        this.container.addEventListener('mouseup', this.handleEnd.bind(this));

        // 触摸事件
        this.container.addEventListener('touchstart', this.handleStart.bind(this));
        this.container.addEventListener('touchmove', this.handleMove.bind(this));
        this.container.addEventListener('touchend', this.handleEnd.bind(this));

        // 防止默认行为
        this.container.addEventListener('dragstart', (e) => e.preventDefault());
        this.container.addEventListener('selectstart', (e) => e.preventDefault());

        // 音效触发
        this.container.addEventListener('mousedown', () => {
            this.audioManager.resumeAudioContext();
        });

        // 音效控制按钮
        const soundToggle = document.getElementById('soundToggle');
        soundToggle.addEventListener('click', () => {
            const isEnabled = this.audioManager.toggle();
            soundToggle.textContent = isEnabled ? '🔊' : '🔇';
        });

        // 窗口大小改变
        window.addEventListener('resize', () => {
            this.setupCanvas();
        });
    }

    handleStart(e) {
        const point = this.getPointFromEvent(e);
        const bubble = this.getBubbleAtPoint(point.x, point.y);

        if (bubble) {
            bubble.isDragging = true;
            bubble.element.classList.add('dragging');
            this.draggedBubble = bubble;
            this.dragOffset = {
                x: point.x - bubble.x,
                y: point.y - bubble.y
            };
            e.preventDefault();
        }
    }

    handleMove(e) {
        if (!this.draggedBubble) return;

        const point = this.getPointFromEvent(e);
        this.draggedBubble.x = point.x - this.dragOffset.x;
        this.draggedBubble.y = point.y - this.dragOffset.y;

        this.updateBubblePosition(this.draggedBubble);
        e.preventDefault();
    }

    handleEnd(e) {
        if (this.draggedBubble) {
            // 检查是否有碰撞的泡泡
            const nearbyBubble = this.getNearbyBubble(this.draggedBubble);
            if (nearbyBubble && nearbyBubble !== this.draggedBubble) {
                this.mergeBubbles(this.draggedBubble, nearbyBubble);
            }

            this.draggedBubble.isDragging = false;
            this.draggedBubble.element.classList.remove('dragging');
            this.draggedBubble = null;
        }
        e.preventDefault();
    }

    getPointFromEvent(e) {
        const rect = this.container.getBoundingClientRect();
        if (e.touches) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        } else {
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }
    }

    getBubbleAtPoint(x, y) {
        return this.bubbles.find(bubble => {
            const dx = x - bubble.x;
            const dy = y - bubble.y;
            return Math.sqrt(dx * dx + dy * dy) < bubble.radius;
        });
    }

    getNearbyBubble(bubble) {
        const threshold = bubble.radius * 2.5;
        return this.bubbles.find(other => {
            if (other === bubble) return false;
            const dx = bubble.x - other.x;
            const dy = bubble.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < threshold;
        });
    }

    mergeBubbles(bubble1, bubble2) {
        // 合并泡泡
        const newNumber = bubble1.number + bubble2.number;
        const newX = (bubble1.x + bubble2.x) / 2;
        const newY = (bubble1.y + bubble2.y) / 2;

        // 播放音效
        this.audioManager.play('bubbleMerge');

        // 创建粒子效果
        this.particleManager.createBubbleMergeEffect(newX, newY);

        // 创建波纹效果
        this.rippleManager.createRipple(newX, newY);

        // 移除旧的泡泡
        this.removeBubble(bubble1);
        this.removeBubble(bubble2);

        // 创建新的泡泡
        const newBubble = this.createBubble(newX, newY, newNumber);
        newBubble.element.classList.add('merging');

        // 增加分数
        this.score += newNumber;

        setTimeout(() => {
            if (newBubble.element) {
                newBubble.element.classList.remove('merging');
            }
        }, 300);
    }

    removeBubble(bubble) {
        const index = this.bubbles.indexOf(bubble);
        if (index > -1) {
            this.bubbles.splice(index, 1);
            if (bubble.element) {
                bubble.element.remove();
            }
        }
    }

    updateBubblePosition(bubble) {
        if (bubble.element) {
            bubble.element.style.left = `${bubble.x - bubble.radius}px`;
            bubble.element.style.top = `${bubble.y - bubble.radius}px`;
        }
    }

    updateFishPosition() {
        if (this.fish.element) {
            this.fish.element.style.left = `${this.fish.x - 30}px`;
            this.fish.element.style.top = `${this.fish.y - 20}px`;
        }
    }

    updateFishAI() {
        // 寻找目标泡泡
        let targetBubble = null;
        let minDistance = Infinity;

        this.bubbles.forEach(bubble => {
            if (bubble.number === this.fish.number) {
                const dx = bubble.x - this.fish.x;
                const dy = bubble.y - this.fish.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance) {
                    minDistance = distance;
                    targetBubble = bubble;
                }
            }
        });

        if (targetBubble) {
            // 向目标泡泡移动
            const dx = targetBubble.x - this.fish.x;
            const dy = targetBubble.y - this.fish.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 5) {
                const speed = 1.5;
                this.fish.x += (dx / distance) * speed;
                this.fish.y += (dy / distance) * speed;
                this.updateFishPosition();
            } else {
                // 吃泡泡
                this.eatBubble(targetBubble);
            }
        } else {
            // 随机游动
            this.fish.vx = (Math.random() - 0.5) * 2;
            this.fish.vy = (Math.random() - 0.5) * 2;
            this.fish.x += this.fish.vx;
            this.fish.y += this.fish.vy;

            // 边界检查
            this.fish.x = Math.max(30, Math.min(this.width - 30, this.fish.x));
            this.fish.y = Math.max(20, Math.min(this.height - 20, this.fish.y));

            this.updateFishPosition();
        }
    }

    eatBubble(bubble) {
        // 播放音效
        this.audioManager.play('fishEat');

        // 创建粒子效果
        this.particleManager.createEatEffect(bubble.x, bubble.y);

        // 创建波纹效果
        this.rippleManager.createRipple(bubble.x, bubble.y, 'rgba(255, 215, 0, 0.8)');

        // 吃鱼
        this.fish.element.classList.add('eating');
        this.removeBubble(bubble);

        // 增加分数
        this.score += this.fish.number * 2;

        // 增加已吃计数
        this.fish.eatenCount++;

        // 检查是否该升级了
        if (this.fish.eatenCount >= this.fish.maxEaten) {
            this.fishSize += 1;
            this.fish.eatenCount = 0;

            // 更新鱼的大小
            const scale = 1 + (this.fishSize - 10) * 0.05;
            this.fish.element.style.transform = `scale(${scale})`;
        }

        setTimeout(() => {
            this.fish.element.classList.remove('eating');
        }, 500);

        // 生成新泡泡 - 智能生成有用的数字，并确保仍然可解
        setTimeout(() => {
            this.createSmartBubble();
            // 再次验证组合有效性
            this.ensureValidCombinations();
        }, 1000);
    }

    updateBubbles() {
        // 性能优化：批量更新泡泡位置
        const updates = [];

        this.bubbles.forEach(bubble => {
            if (!bubble.isDragging) {
                // 泡泡浮动
                bubble.x += bubble.vx * 0.5;
                bubble.y += bubble.vy * 0.5;

                // 边界反弹
                if (bubble.x < bubble.radius || bubble.x > this.width - bubble.radius) {
                    bubble.vx *= -1;
                }
                if (bubble.y < bubble.radius || bubble.y > this.height - bubble.radius) {
                    bubble.vy *= -1;
                }

                // 收集更新信息
                updates.push({
                    element: bubble.element,
                    x: bubble.x - bubble.radius,
                    y: bubble.y - bubble.radius
                });
            }
        });

        // 批量更新DOM
        requestAnimationFrame(() => {
            updates.forEach(update => {
                if (update.element) {
                    update.element.style.left = `${update.x}px`;
                    update.element.style.top = `${update.y}px`;
                }
            });
        });
    }

    canFormTargetNumber(target, currentNumbers) {
        // 检查给定的数字是否能通过加法组合成目标数字
        // 使用动态规划方法
        const dp = new Array(target + 1).fill(false);
        dp[0] = true; // 0可以通过不选择任何数字得到

        for (let num of currentNumbers) {
            for (let i = target; i >= num; i--) {
                if (dp[i - num]) {
                    dp[i] = true;
                }
            }
        }

        return dp[target];
    }

    ensureValidCombinations() {
        // 确保当前泡泡可以组合成目标数字
        const target = this.fish.number;
        const currentNumbers = this.bubbles.map(b => b.number);

        if (!this.canFormTargetNumber(target, currentNumbers)) {
            // 如果不能组合成目标数字，添加缺失的数字
            let missingNumber = 1;

            // 找到一个能让系统重新有解的数字
            for (let i = 1; i <= target; i++) {
                const testNumbers = [...currentNumbers, i];
                if (this.canFormTargetNumber(target, testNumbers)) {
                    missingNumber = i;
                    break;
                }
            }

            // 添加这个缺失的数字
            this.createBubble(null, null, missingNumber);
            console.log(`添加了缺失的数字 ${missingNumber} 以确保可以组合成 ${target}`);
        }
    }

    createSmartBubble() {
        const target = this.fish.number;
        const currentBubbles = this.bubbles.map(b => b.number);

        // 首先确保可以组合成目标数字
        this.ensureValidCombinations();

        // 分析当前泡泡，看看缺少什么数字
        let newNumber;

        // 检查是否缺少等于目标数字的泡泡
        const hasTargetBubbles = currentBubbles.includes(target);
        if (!hasTargetBubbles && Math.random() < 0.3) {
            newNumber = target;
        } else {
            // 生成可以帮助合成目标数字的数字
            const possibleNumbers = [];
            for (let i = 1; i < target; i++) {
                possibleNumbers.push(i);
            }

            // 优先生成能与现有泡泡组合的数字
            let bestNumber = null;
            for (let num of currentBubbles) {
                if (num < target && (num + num) <= target) {
                    bestNumber = num;
                    break;
                }
            }

            if (bestNumber && Math.random() < 0.5) {
                newNumber = bestNumber;
            } else {
                // 随机选择一个有用的数字，确保不会破坏可解性
                const validNumbers = possibleNumbers.filter(num => {
                    const testNumbers = [...currentBubbles, num];
                    return this.canFormTargetNumber(target, testNumbers);
                });

                if (validNumbers.length > 0) {
                    newNumber = validNumbers[Math.floor(Math.random() * validNumbers.length)];
                } else {
                    // 如果没有有效的数字，选择1（总是安全的）
                    newNumber = 1;
                }
            }
        }

        this.createBubble(null, null, newNumber);
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('fishSize').textContent = this.fishSize;
        document.getElementById('bubblesCount').textContent = this.bubbles.length;
        document.getElementById('fishProgress').textContent = `${this.fish.eatenCount}/${this.fish.maxEaten}`;
        document.getElementById('targetNumber').textContent = this.fish.number;
    }

    gameLoop() {
        if (!this.gameRunning || this.isPaused) {
            requestAnimationFrame(() => this.gameLoop());
            return;
        }

        this.updateFishAI();
        this.updateBubbles();
        this.updateUI();

        // 检查游戏结束条件
        this.checkGameOver();

        requestAnimationFrame(() => this.gameLoop());
    }

    startGameLoop() {
        this.gameLoop();
    }

    checkGameOver() {
        // 游戏结束条件：没有泡泡了或鱼变得太大
        const currentTime = Date.now();
        const gameDuration = (currentTime - this.startTime) / 1000; // 秒

        // 检查是否还有可以合成的泡泡
        const currentNumbers = this.bubbles.map(b => b.number);
        const canFormTarget = this.canFormTargetNumber(this.fish.number, currentNumbers);

        if (!canFormTarget || this.fishSize >= 30 || gameDuration > 600) { // 10分钟或鱼大小达到30
            this.showGameOver();
        }
    }

    showGameOver() {
        this.isPaused = true;
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalFishSize').textContent = this.fishSize;
        document.getElementById('gameOver').style.display = 'block';
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        document.getElementById('gameOver').style.display = 'none';
    }

    restart() {
        // 保存当前鱼的数字
        const currentFishNumber = this.fish ? this.fish.number : Math.floor(Math.random() * 10) + 1;

        // 重置游戏状态
        this.score = 0;
        this.fishSize = 10;
        this.isPaused = false;
        this.startTime = Date.now();

        // 清除现有元素
        this.bubbles.forEach(bubble => {
            if (bubble.element) bubble.element.remove();
        });
        this.bubbles = [];

        if (this.fish.element) {
            this.fish.element.remove();
        }

        // 重新创建游戏元素，保持鱼的数字不变
        this.fish = {
            x: this.width / 2,
            y: this.height / 2,
            targetX: this.width / 2,
            targetY: this.height / 2,
            number: currentFishNumber,
            element: this.createFishElement(currentFishNumber),
            eatenCount: 0,
            maxEaten: 5
        };
        this.updateFishPosition();

        this.generateInitialBubbles();

        // 隐藏游戏结束界面
        document.getElementById('gameOver').style.display = 'none';

        // 更新UI
        this.updateUI();
    }
}

// 初始化游戏
let game;
window.addEventListener('load', () => {
    game = new MathFishGame();
});

// 防止页面滚动
window.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });