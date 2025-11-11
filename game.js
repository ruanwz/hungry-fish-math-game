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

        // 游戏模式设置
        this.gameMode = {
            operation: 'addition', // 'addition' | 'multiplication'
            maxNumber: 10,        // 1-50范围
            difficulty: 'normal'
        };

        // 加载保存的设置
        this.loadSettings();

        // 初始化音效和动画管理器
        this.audioManager = new AudioManager();
        this.particleManager = new ParticleManager(this.container);
        this.rippleManager = new RippleManager(this.container);

        this.init();
    }

    loadSettings() {
        // 从localStorage加载保存的设置
        const savedSettings = localStorage.getItem('hungryFishSettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                if (settings.operation) this.gameMode.operation = settings.operation;
                if (settings.maxNumber) this.gameMode.maxNumber = Math.min(50, Math.max(1, settings.maxNumber));
            } catch (e) {
                console.log('加载设置失败，使用默认设置');
            }
        }
    }

    saveSettings() {
        // 保存设置到localStorage
        const settings = {
            operation: this.gameMode.operation,
            maxNumber: this.gameMode.maxNumber
        };
        localStorage.setItem('hungryFishSettings', JSON.stringify(settings));
    }

    updateSettings(operation, maxNumber) {
        // 更新游戏设置
        const oldOperation = this.gameMode.operation;
        const oldMaxNumber = this.gameMode.maxNumber;

        this.gameMode.operation = operation;
        this.gameMode.maxNumber = Math.min(50, Math.max(1, maxNumber));

        // 保存新设置
        this.saveSettings();

        // 如果设置有变化，重启游戏
        if (oldOperation !== operation || oldMaxNumber !== this.gameMode.maxNumber) {
            this.showSettingsChangeNotification();
            setTimeout(() => {
                this.restart();
            }, 1000);
        }
    }

    showSettingsChangeNotification() {
        // 显示设置变更通知
        const notification = document.createElement('div');
        notification.id = 'settingsNotification';
        notification.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-size: 18px;
            text-align: center;
            z-index: 3000;
            animation: fadeInOut 2s ease-in-out;
        `;
        notification.textContent = '设置已更改，游戏将重新开始...';

        // 添加动画样式
        if (!document.getElementById('settingsNotificationStyle')) {
            const style = document.createElement('style');
            style.id = 'settingsNotificationStyle';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                }
            `;
            document.head.appendChild(style);
        }

        this.container.appendChild(notification);

        // 2秒后移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
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
        // 生成鱼的数字，根据游戏模式和设置
        let fishNumber;
        const maxNum = this.gameMode.maxNumber;

        if (this.gameMode.operation === 'addition') {
            // 加法模式下避免生成1（无法通过正数相加得到1）
            // 如果设置的最大值大于1，使用设置值，否则随机生成
            if (maxNum > 1) {
                fishNumber = maxNum;
            } else {
                fishNumber = Math.floor(Math.random() * 9) + 2; // 生成2-10的数字
            }
        } else {
            // 乘法模式下直接使用设置值
            fishNumber = maxNum;
        }

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

        if (this.gameMode.operation === 'multiplication') {
            // 乘法模式：生成目标数字的因数
            if (target === 1) {
                // 如果目标是1，只生成1
                for (let i = 0; i < 6; i++) {
                    this.createBubble(null, null, 1);
                }
            } else {
                // 寻找目标数字的因数
                const factors = [];
                for (let i = 1; i <= Math.sqrt(target); i++) {
                    if (target % i === 0) {
                        if (i !== target) factors.push(i);
                        if (i !== target / i && target / i !== target && target / i <= 10) {
                            factors.push(target / i);
                        }
                    }
                }

                // 如果没有合适的因数，生成一些小数字
                if (factors.length === 0) {
                    factors.push(1, 2, 3);
                }

                // 生成因数泡泡
                for (let i = 0; i < 6; i++) {
                    const factor = factors[Math.floor(Math.random() * factors.length)];
                    this.createBubble(null, null, factor);
                }

                // 再生成一些小数字作为补充
                for (let i = 0; i < 2; i++) {
                    const smallNumber = Math.floor(Math.random() * 3) + 1;
                    this.createBubble(null, null, smallNumber);
                }
            }
        } else {
            // 加法模式：使用原来的逻辑
            // 生成一些有用的泡泡（不等于目标数字，且可以组合成目标数字）
            for (let i = 0; i < 8; i++) {
                // 生成1到target-1的数字（确保不等于target）
                const maxNumber = target - 1;
                const number = Math.floor(Math.random() * maxNumber) + 1;
                this.createBubble(null, null, number);
            }
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

        // 设置控件事件监听
        this.setupSettingsControls();
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
        // 合并泡泡，根据游戏模式选择加法或乘法
        let newNumber;
        if (this.gameMode.operation === 'multiplication') {
            newNumber = bubble1.number * bubble2.number;
        } else {
            newNumber = bubble1.number + bubble2.number;
        }

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
        // 检查给定的数字是否能通过加法或乘法组合成目标数字
        // 根据游戏模式选择不同的算法

        if (this.gameMode.operation === 'multiplication') {
            // 乘法模式：检查是否能通过乘法得到目标数字
            // 对于乘法，我们需要检查是否存在数字的乘积等于目标
            if (target === 1) {
                // 如果目标是1，只要有1就可以（1乘以任何数都是那个数）
                return currentNumbers.includes(1);
            }

            // 检查是否有数字的乘积等于目标
            return this.canFormTargetByMultiplication(target, currentNumbers);
        } else {
            // 加法模式：检查是否能通过加法组合成目标数字
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
    }

    canFormTargetByMultiplication(target, numbers) {
        // 辅助方法：检查是否可以通过乘法得到目标数字
        // 简化版本：检查是否存在两个数字的乘积等于目标

        // 如果只有一个数字，检查是否能通过自乘得到目标
        if (numbers.length === 1) {
            return numbers[0] * numbers[0] === target;
        }

        // 检查是否存在两个数字的乘积等于目标
        for (let i = 0; i < numbers.length; i++) {
            for (let j = 0; j < numbers.length; j++) {
                if (i !== j && numbers[i] * numbers[j] === target) {
                    return true;
                }
            }
        }

        // 也检查单个数字是否能通过自乘得到目标（平方）
        for (let num of numbers) {
            if (num * num === target) {
                return true;
            }
        }

        return false;
    }

    ensureValidCombinations() {
        // 确保当前泡泡可以组合成目标数字
        const target = this.fish.number;
        const currentNumbers = this.bubbles.map(b => b.number);

        if (!this.canFormTargetNumber(target, currentNumbers)) {
            // 如果不能组合成目标数字，添加缺失的数字
            // 但要避免直接添加目标数字（我们希望用户通过合并来创造目标数字）
            let missingNumber = 1;

            if (this.gameMode.operation === 'multiplication') {
                // 乘法模式：寻找目标数字的因数
                if (target === 1) {
                    missingNumber = 1;
                } else {
                    // 寻找目标数字的因数（不包括目标数字本身）
                    const factors = [];
                    for (let i = 1; i <= Math.sqrt(target); i++) {
                        if (target % i === 0) {
                            if (i !== target) factors.push(i);
                            if (i !== target / i && target / i !== target) {
                                factors.push(target / i);
                            }
                        }
                    }

                    if (factors.length > 0) {
                        // 选择一个能让系统有解的因数
                        for (let factor of factors) {
                            const testNumbers = [...currentNumbers, factor];
                            if (this.canFormTargetNumber(target, testNumbers)) {
                                missingNumber = factor;
                                break;
                            }
                        }
                    } else {
                        // 如果没有合适的因数，添加1或2
                        missingNumber = (target > 2) ? 2 : 1;
                    }
                }
            } else {
                // 加法模式：使用加法逻辑
                // 找到一个能让系统重新有解的数字，优先选择非目标数字
                for (let i = 1; i <= target; i++) {
                    if (i === target) continue; // 跳过目标数字本身
                    const testNumbers = [...currentNumbers, i];
                    if (this.canFormTargetNumber(target, testNumbers)) {
                        missingNumber = i;
                        break;
                    }
                }

                // 如果只有添加目标数字才能解决问题，那么添加一个较小的数字（如1）
                // 这样玩家至少可以通过合并来逐步接近目标
                if (missingNumber === target) {
                    missingNumber = 1; // 总是可以添加1，因为1可以参与任何加法组合
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

        // 重要：永远不要直接生成目标数字的泡泡
        // 我们希望玩家必须通过合并来创造目标数字

        if (this.gameMode.operation === 'multiplication') {
            // 乘法模式：生成能帮助乘法合成的数字
            // 对于乘法，我们需要考虑因数
            if (target === 1) {
                newNumber = 1;
            } else {
                // 寻找目标数字的因数
                const factors = [];
                for (let i = 1; i <= Math.sqrt(target); i++) {
                    if (target % i === 0) {
                        factors.push(i);
                        if (i !== target / i) {
                            factors.push(target / i);
                        }
                    }
                }

                // 过滤掉目标数字本身，选择其他因数
                const validFactors = factors.filter(f => f !== target && f <= 10);

                if (validFactors.length > 0) {
                    newNumber = validFactors[Math.floor(Math.random() * validFactors.length)];
                } else {
                    // 如果没有合适的因数，生成一个小数字
                    newNumber = Math.floor(Math.random() * 3) + 1;
                }
            }
        } else {
            // 加法模式：生成能帮助加法合成的数字
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
        // 防止重复触发游戏结束
        if (this.isPaused || document.getElementById('gameOver').style.display === 'block') {
            return;
        }

        // 游戏结束条件：没有泡泡了或鱼变得太大
        const currentTime = Date.now();
        const gameDuration = (currentTime - this.startTime) / 1000; // 秒

        // 检查是否还有可以合成的泡泡
        const currentNumbers = this.bubbles.map(b => b.number);
        const canFormTarget = this.canFormTargetNumber(this.fish.number, currentNumbers);

        // 调试日志
        if (this.gameMode.operation === 'multiplication') {
            console.log(`乘法模式检查: 目标=${this.fish.number}, 当前数字=[${currentNumbers.join(',')}], 可合成=${canFormTarget}, 泡泡数=${this.bubbles.length}`);
        }

        if (!canFormTarget || this.fishSize >= 30 || gameDuration > 600) { // 10分钟或鱼大小达到30
            console.log(`游戏结束条件触发: 可合成=${canFormTarget}, 鱼大小=${this.fishSize}, 游戏时长=${gameDuration}`);
            this.showGameOver();
        }
    }

    showGameOver() {
        console.log('显示游戏结束界面');
        this.isPaused = true;
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalFishSize').textContent = this.fishSize;
        document.getElementById('gameOver').style.display = 'block';
        console.log('游戏结束界面已显示，暂停状态：', this.isPaused);
    }

    togglePause() {
        console.log('togglePause被调用，当前游戏结束界面状态：', document.getElementById('gameOver').style.display);

        // 只有在游戏结束状态下才允许继续游戏
        if (document.getElementById('gameOver').style.display === 'block') {
            console.log('关闭游戏结束界面');
            this.isPaused = false;
            document.getElementById('gameOver').style.display = 'none';
            // 重置游戏时间，避免立即再次触发游戏结束
            this.startTime = Date.now();
            console.log('游戏继续，暂停状态：', this.isPaused);
        } else {
            // 正常暂停/继续逻辑
            this.isPaused = !this.isPaused;
            console.log('正常暂停切换，暂停状态：', this.isPaused);
        }
    }

    restart() {
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

        // 重新创建鱼，使用当前游戏设置的目标数字
        this.createFish();

        this.generateInitialBubbles();

        // 隐藏游戏结束界面
        document.getElementById('gameOver').style.display = 'none';

        // 更新UI
        this.updateUI();
    }

    setupSettingsControls() {
        // 数字范围滑块
        const numberRange = document.getElementById('numberRange');
        const numberRangeValue = document.getElementById('numberRangeValue');

        // 设置初始值
        if (numberRange) {
            numberRange.value = this.gameMode.maxNumber;
            numberRangeValue.textContent = this.gameMode.maxNumber;

            // 滑块值变化事件
            numberRange.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                numberRangeValue.textContent = value;
            });

            // 滑块释放时更新设置
            numberRange.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                this.updateSettings(this.gameMode.operation, value);
            });
        }

        // 模式切换开关
        const modeToggle = document.getElementById('modeToggle');
        const additionLabel = document.querySelector('.addition-label');
        const multiplicationLabel = document.querySelector('.multiplication-label');

        // 设置初始状态
        if (modeToggle) {
            modeToggle.checked = this.gameMode.operation === 'multiplication';
            this.updateModeDisplay(); // 更新模式显示
            this.updateModeLabels(); // 更新标签状态

            // 模式切换事件
            modeToggle.addEventListener('change', (e) => {
                const operation = e.target.checked ? 'multiplication' : 'addition';
                this.updateModeDisplay(); // 更新显示
                this.updateModeLabels(); // 更新标签状态
                this.updateSettings(operation, this.gameMode.maxNumber);
            });
        }

        // 游戏结束按钮事件绑定
        const restartButton = document.getElementById('restartButton');
        const continueButton = document.getElementById('continueButton');

        if (restartButton) {
            restartButton.addEventListener('click', (e) => {
                console.log('重新开始按钮被点击');
                e.preventDefault();
                e.stopPropagation();
                this.restart();
            });
        }

        if (continueButton) {
            continueButton.addEventListener('click', (e) => {
                console.log('继续游戏按钮被点击');
                e.preventDefault();
                e.stopPropagation();
                this.togglePause();
            });
        }
    }

    updateModeLabels() {
        // 模式标签激活状态现在由CSS自动处理，不需要JavaScript干预
        // 保持这个方法以备将来需要动态更新
    }

    updateModeDisplay() {
        // 移除了重复的模式显示，现在只在切换开关旁边显示
        // 这个方法现在可以留空或删除
    }

    showSettingsChangeNotification() {
        // 显示设置变更通知
        const notification = document.createElement('div');
        notification.id = 'settingsNotification';
        notification.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-size: 18px;
            text-align: center;
            z-index: 3000;
            animation: fadeInOut 2s ease-in-out;
        `;
        notification.textContent = '设置已更改，游戏将重新开始...';

        // 添加动画样式
        if (!document.getElementById('settingsNotificationStyle')) {
            const style = document.createElement('style');
            style.id = 'settingsNotificationStyle';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                }
            `;
            document.head.appendChild(style);
        }

        this.container.appendChild(notification);

        // 2秒后移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
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