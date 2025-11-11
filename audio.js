class AudioManager {
    constructor() {
        this.enabled = true;
        this.sounds = {};
        this.initSounds();
    }

    initSounds() {
        // 使用Web Audio API创建简单的音效
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // 预设音效
        this.sounds = {
            bubbleMerge: this.createTone(400, 0.1, 0.3),
            fishEat: this.createTone(600, 0.2, 0.5),
            bubblePop: this.createTone(800, 0.05, 0.2),
            background: this.createBackgroundMusic()
        };
    }

    createTone(frequency, duration, volume) {
        return () => {
            if (!this.enabled || !this.audioContext) return;

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }

    createBackgroundMusic() {
        // 创建简单的背景音乐循环
        return () => {
            if (!this.enabled || !this.audioContext) return;

            // 使用低频振荡器创建波浪声效果
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();

            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
            oscillator.type = 'sine';

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, this.audioContext.currentTime);

            gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);

            oscillator.start();

            // 创建频率变化
            const now = this.audioContext.currentTime;
            oscillator.frequency.setValueAtTime(100, now);
            oscillator.frequency.linearRampToValueAtTime(120, now + 2);
            oscillator.frequency.linearRampToValueAtTime(100, now + 4);

            // 4秒后停止
            oscillator.stop(now + 4);
        };
    }

    play(soundName) {
        if (this.sounds[soundName]) {
            try {
                this.sounds[soundName]();
            } catch (error) {
                console.log('音效播放失败:', error);
            }
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    resumeAudioContext() {
        // 某些浏览器需要用户交互后才能播放音频
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
}

// 粒子效果管理器
class ParticleManager {
    constructor(container) {
        this.container = container;
        this.particles = [];
    }

    createBubbleMergeEffect(x, y) {
        // 创建泡泡合并的粒子效果
        for (let i = 0; i < 8; i++) {
            this.createParticle(x, y, '#87CEEB', 1.5);
        }
    }

    createEatEffect(x, y) {
        // 创建鱼吃泡泡的粒子效果
        for (let i = 0; i < 12; i++) {
            this.createParticle(x, y, '#FFD700', 2.0);
        }
    }

    createParticle(x, y, color, size) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.backgroundColor = color;
        particle.style.borderRadius = '50%';
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '2000';

        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 3 + 1;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;

        this.container.appendChild(particle);

        const animate = () => {
            const currentX = parseFloat(particle.style.left);
            const currentY = parseFloat(particle.style.top);

            particle.style.left = `${currentX + vx}px`;
            particle.style.top = `${currentY + vy}px`;
            particle.style.opacity = parseFloat(particle.style.opacity || '1') - 0.02;

            if (parseFloat(particle.style.opacity) <= 0) {
                particle.remove();
            } else {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }
}

// 波纹效果管理器
class RippleManager {
    constructor(container) {
        this.container = container;
    }

    createRipple(x, y, color = 'rgba(255, 255, 255, 0.6)') {
        const ripple = document.createElement('div');
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.border = `2px solid ${color}`;
        ripple.style.left = `${x - 25}px`;
        ripple.style.top = `${y - 25}px`;
        ripple.style.width = '50px';
        ripple.style.height = '50px';
        ripple.style.pointerEvents = 'none';
        ripple.style.zIndex = '1500';

        this.container.appendChild(ripple);

        // 动画效果
        let scale = 1;
        let opacity = 1;

        const animate = () => {
            scale += 0.1;
            opacity -= 0.05;

            ripple.style.transform = `scale(${scale})`;
            ripple.style.opacity = opacity;

            if (opacity <= 0) {
                ripple.remove();
            } else {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }
}

// 导出管理器
window.AudioManager = AudioManager;
window.ParticleManager = ParticleManager;
window.RippleManager = RippleManager;