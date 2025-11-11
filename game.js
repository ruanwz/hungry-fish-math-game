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
        this.createFish();
        this.generateInitialBubbles();
        this.setupEventListeners();
        this.startGameLoop();
        this.updateUI();
    }

    setupSettingsControls() {
        // 数字范围滑块
        const numberRange = document.getElementById('numberRange');
        const numberRangeValue = document.getElementById('numberRangeValue');

        // 设置初始值
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

        // 模式切换开关
        const modeToggle = document.getElementById('modeToggle');

        // 设置初始状态
        modeToggle.checked = this.gameMode.operation === 'multiplication';

        // 模式切换事件
        modeToggle.addEventListener('change', (e) => {
            const operation = e.target.checked ? 'multiplication' : 'addition';
            this.updateSettings(operation, this.gameMode.maxNumber);
        });
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
            fishNumber = Math.floor(Math.random() * (maxNum - 1)) + 2; // 生成2-maxNum的数字
        } else {
            // 乘法模式下可以生成1-50的任何数字
            fishNumber = Math.floor(Math.random() * maxNum) + 1; // 生成1-maxNum的数字
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

        if (this.gameMode.operation === 'addition') {
            // 加法模式：生成一些有用的泡泡（不等于目标数字，且可以组合成目标数字）
            for (let i = 0; i < 8; i++) {
                // 生成1到target-1的数字（确保不等于target）
                const maxNumber = target - 1;
                const number = Math.floor(Math.random() * maxNumber) + 1;
                this.createBubble(null, null, number);
            }
        } else {
            // 乘法模式：更智能的初始生成
            // 生成目标数字的因子（不包括目标数字本身）
            const factors = [];
            for (let i = 1; i <= Math.sqrt(target); i++) {
                if (target % i === 0) {
                    if (i !== target) factors.push(i);
                    if (i !== target / i && target / i !== target) factors.push(target / i);
                }
            }

            // 如果因子足够多，优先使用因子
            if (factors.length >= 4) {
                // 随机选择4-6个因子
                const selectedFactors = [];
                const factorCount = Math.min(6, factors.length);
                const shuffled = factors.sort(() => Math.random() - 0.5);
                for (let i = 0; i < factorCount; i++) {
                    selectedFactors.push(shuffled[i]);
                }

                // 添加选中的因子
                for (let factor of selectedFactors) {
                    this.createBubble(null, null, factor);
                }

                // 如果需要更多泡泡，添加一些通用数字
                const remainingCount = 8 - selectedFactors.length;
                for (let i = 0; i < remainingCount; i++) {
                    // 选择2-9之间的数字（乘法模式下的好数字）
                    const number = Math.floor(Math.random() * 8) + 2;
                    this.createBubble(null, null, number);
                }
            } else {
                // 如果因子不够多，生成一些通用数字
                for (let i = 0; i < 8; i++) {
                    // 选择2-9之间的数字（乘法模式下的好数字）
                    const number = Math.floor(Math.random() * 8) + 2;
                    this.createBubble(null, null, number);
                }
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

        // 设置控件事件监听
        this.setupSettingsControls();

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
        // 合并泡泡，根据游戏模式选择加法或乘法
        let newNumber;
        const newX = (bubble1.x + bubble2.x) / 2;
        const newY = (bubble1.y + bubble2.y) / 2;

        if (this.gameMode.operation === 'addition') {
            // 加法模式
            newNumber = bubble1.number + bubble2.number;
        } else {
            // 乘法模式
            newNumber = bubble1.number * bubble2.number;
            // 限制最大数字，防止数字过大
            if (newNumber > this.gameMode.maxNumber * 2) {
                newNumber = Math.min(newNumber, this.gameMode.maxNumber * 2);
            }
        }

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

        // 增加分数（乘法模式给予更多分数）
        if (this.gameMode.operation === 'multiplication') {
            this.score += newNumber * 2; // 乘法模式分数翻倍
        } else {
            this.score += newNumber;
        }

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
        if (this.gameMode.operation === 'addition') {
            // 加法模式：使用动态规划
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
        } else {
            // 乘法模式：使用递归回溯算法
            // 因为乘法不满足加法的那种线性关系，需要不同的方法
            return this.canFormTargetMultiplication(target, currentNumbers, {});
        }
    }

    canFormTargetMultiplication(target, numbers, memo) {
        // 乘法模式下的可解性检查
        const key = `${target},${numbers.sort().join(',')}`;
        if (memo[key] !== undefined) return memo[key];

        // 基本情况
        if (target === 1) return true; // 1可以通过不选择任何数字得到（空积）
        if (numbers.length === 0) return false;

        // 检查是否有数字等于目标
        if (numbers.includes(target)) return true;

        // 检查是否可以通过乘法组合得到目标
        for (let i = 0; i < numbers.length; i++) {
            const num = numbers[i];
            if (target % num === 0) { // 只有能整除才可能有解
                const remaining = target / num;
                const remainingNumbers = [...numbers.slice(0, i), ...numbers.slice(i + 1)];

                if (this.canFormTargetMultiplication(remaining, remainingNumbers, memo)) {
                    memo[key] = true;
                    return true;
                }
            }
        }

        memo[key] = false;
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

            if (this.gameMode.operation === 'addition') {
                // 加法模式：找到一个能让系统重新有解的数字，优先选择非目标数字
                for (let i = 1; i <= target; i++) {
                    if (i === target) continue; // 跳过目标数字本身
                    const testNumbers = [...currentNumbers, i];
                    if (this.canFormTargetNumber(target, testNumbers)) {
                        missingNumber = i;
                        break;
                    }
                }

                // 如果只有添加目标数字才能解决问题，那么添加1
                if (missingNumber === target) {
                    missingNumber = 1;
                }
            } else {
                // 乘法模式：更复杂的逻辑
                // 寻找目标数字的因子
                const factors = [];
                for (let i = 1; i <= Math.sqrt(target); i++) {
                    if (target % i === 0) {
                        factors.push(i);
                        if (i !== target / i) factors.push(target / i);
                    }
                }

                // 优先添加不是目标数字的因子
                for (let factor of factors.sort((a, b) => a - b)) {
                    if (factor !== target && factor <= this.gameMode.maxNumber) {
                        const testNumbers = [...currentNumbers, factor];
                        if (this.canFormTargetNumber(target, testNumbers)) {
                            missingNumber = factor;
                            break;
                        }
                    }
                }

                // 如果没有合适的因子，添加2（乘法模式下的通用数字）
                if (missingNumber === 1 && target > 1) {
                    missingNumber = 2;
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

        if (this.gameMode.operation === 'addition') {
            // 加法模式：生成可以帮助合成目标数字的数字（但不包括目标数字本身）
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
        } else {
            // 乘法模式：更智能的生成策略
            // 寻找目标数字的因子
            const factors = [];
            for (let i = 1; i <= Math.sqrt(target); i++) {
                if (target % i === 0) {
                    factors.push(i);
                    if (i !== target / i) factors.push(target / i);
                }
            }

            // 过滤掉目标数字本身和过大的因子
            const validFactors = factors.filter(factor =>
                factor !== target && factor <= this.gameMode.maxNumber
            );

            if (validFactors.length > 0 && Math.random() < 0.6) {
                // 60%概率选择因子
                newNumber = validFactors[Math.floor(Math.random() * validFactors.length)];
            } else {
                // 否则选择2-9之间的数字（乘法模式下的通用好数字）
                newNumber = Math.floor(Math.random() * 8) + 2;
            }

            // 确保不会破坏可解性
            const testNumbers = [...currentBubbles, newNumber];
            if (!this.canFormTargetNumber(target, testNumbers)) {
                // 如果会破坏可解性，选择1（安全选择）
                newNumber = 1;
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
        // 重置游戏状态（不再保存鱼的数字，让createFish根据当前设置生成）
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

        // 重新创建游戏元素，根据当前设置生成新的鱼数字
        this.createFish();

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