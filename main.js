class Wheel {
    constructor(config) {
        this.img = document.getElementById("wheel");
        this.config = config;
        this.projector = null;

        this.angularSectionWidth = (2 * Math.PI) / this.config.numSections;
        this.selectedIndex = this.config.startingIndex || 0;
        this.lockControls = false;

        this.anim = null;

        // Set initial rotation
        this.img.style.transform = `rotate(${
            360 - degrees(this.getRotation(this.selectedIndex))
        }deg)`;
    }

    createControls() {
        document.onclick = (e) => {
            if (this.lockControls) return;

            let content = document.getElementById("content-" + this.selectedIndex);
            if (!content || !content.contains(e.target)) {
                let delta = e.x < window.innerWidth / 2 ? -1 : 1;
                this.rotateSectionsBy(delta);
            }
        };
        document.onwheel = (e) => {
            if (this.lockControls) return;

            let content = document.getElementById("content-" + this.selectedIndex);
            if (!content || !content.contains(e.target)) {
                if (e.deltaY !== 0) {
                    let delta = e.deltaY > 0 ? 1 : -1;
                    if (this.config.invertScroll) delta = -delta;
                    this.rotateSectionsBy(delta);
                }
            }
        };
        document.onkeydown = (e) => {
            if (this.lockControls) return;

            if (e.key === "ArrowLeft") this.rotateSectionsBy(-1);
            else if (e.key === "ArrowRight") this.rotateSectionsBy(1);
        };
    }

    rotateToSection(index) {
        // Prevent fast rotations
        if (this.config.controlLockDuration > 0) {
            this.lockControls = true;
            setTimeout(() => {
                this.lockControls = false;
            }, this.config.controlLockDuration);
        }

        let oldIndex = this.selectedIndex;
        let oldRot = this.getRotation(oldIndex);
        let newRot = this.getRotation(index);
        this.selectedIndex = index;

        // make sure it rotates in the closest direction
        if (newRot - oldRot > Math.PI) oldRot += Math.PI * 2;
        else if (oldRot - newRot > Math.PI) newRot += Math.PI * 2;

        if (this.anim) this.anim.cancel();
        this.anim = animate(this.img, {
            rotate: [360 - degrees(oldRot), 360 - degrees(newRot)],
            duration: this.config.animWheelDuration,
            ease: this.config.animEasing,
        });
        this.projector.animateRotation(oldIndex, index, oldRot, newRot);
    }

    rotateSectionsBy(delta) {
        let index = (this.selectedIndex + delta) % this.config.numSections;
        if (index < 0) index += this.config.numSections;

        this.rotateToSection(index);
    }

    getRotation(index) {
        return index * this.angularSectionWidth;
    }
}

class Projector {
    constructor(wheel) {
        wheel.projector = this;
        this.wheel = wheel;
        this.ctx = document.getElementById("projector").getContext("2d");
        this.container = document.getElementById("content-container");

        // Animation stuff
        this.rotation = this.wheel.getRotation(this.wheel.selectedIndex);
        this.progress = 100;
        this.anim = null;

        // create sections
        this.sections = [];
        this.createSections();

        window.onresize = () => {
            this.resizeCanvas();
        };
        this.resizeCanvas();
    }

    createSections() {
        for (let i = 0; i < this.wheel.config.numSections; i++) {
            let section = new ContentSection(this, i);
            this.sections.push(section);
        }
    }

    requestDraw(direction = 1) {
        window.requestAnimationFrame(() => this.draw(direction));
    }

    draw(direction = 1) {
        const numSections = this.sections.length;

        // Clear canvas
        const width = this.ctx.canvas.width;
        const height = this.ctx.canvas.height;
        this.ctx.clearRect(0, 0, width, height);

        const index = this.wheel.selectedIndex;
        const prevIndex = (index - direction + numSections) % numSections;
        const prevPrevIndex = (index - 2 * direction + numSections) % numSections;
        const nextIndex = (index + direction + numSections) % numSections;

        // draw left and right halves of the background
        // t = 0   -> left prevprev right current
        // t = 0.3 -> entirely current
        // t = 0.7 -> left prev right next
        let left, right;
        if (this.progress < 30) {
            left = prevPrevIndex;
            right = index;
        } else if (this.progress < 70) {
            left = index;
            right = index;
        } else {
            left = prevIndex;
            right = nextIndex;
        }
        if (direction == -1) {
            // swap left and right if rotating back
            [left, right] = [right, left];
        }

        this.ctx.fillStyle = this.wheel.config.sectionColors[left];
        this.ctx.fillRect(0, 0, width / 2, height);
        this.ctx.fillStyle = this.wheel.config.sectionColors[right];
        this.ctx.fillRect(width / 2, 0, width / 2, height);

        // Draw slice
        if (this.progress < 70) {
            this.sections[prevIndex].draw();
        } else {
            this.sections[index].draw();
        }
    }

    resizeCanvas() {
        this.ctx.canvas.width = window.innerWidth;
        this.ctx.canvas.height = window.innerHeight;

        this.requestDraw();
    }

    animateRotation(oldIndex, newIndex, oldRot, newRot) {
        const direction = newRot > oldRot ? 1 : -1;

        if (this.anim) this.anim.cancel();
        this.anim = animate(this, {
            rotation: [oldRot, newRot],
            progress: [0, 100],
            duration: this.wheel.config.animProjectorDuration,
            onUpdate: () => this.draw(direction),
            ease: this.wheel.config.animEasing,
            // ease: "linear",
        });

        this.sections[oldIndex].animateOut(direction);
        this.sections[newIndex].animateIn(direction);
    }
}

class ContentSection {
    constructor(projector, i) {
        this.proj = projector;
        this.wheel = projector.wheel;
        this.ctx = projector.ctx;
        this.i = i;
        this.anim = null;

        this.content = document.getElementById("content-" + i);
        if (this.content && i != this.wheel.selectedIndex) {
            this.content.style.opacity = "0";
            this.content.classList.add("d-none");
        }
    }

    animateIn(direction) {
        if (this.anim) this.anim.cancel();

        if (this.content) {
            this.content.classList.remove("d-none");
            this.anim = animate(this.content, {
                translateX: [1000 * direction, 0],
                opacity: [0, 1],
                duration: this.wheel.config.animProjectorDuration,
                ease: this.wheel.config.animEasing,
            });
        }
    }

    animateOut(direction) {
        if (this.anim) this.anim.cancel();

        if (this.content) {
            this.anim = animate(this.content, {
                translateX: [0, -1000 * direction],
                opacity: [1, 0],
                duration: this.wheel.config.animProjectorDuration,
                ease: this.wheel.config.animEasing,
                onComplete: () => this.content.classList.add("d-none"),
            });
        }
    }

    draw() {
        let rot = this.wheel.getRotation(this.i) - this.proj.rotation;
        let startAngle = rot - this.wheel.config.projectorAngularSectionWidth / 2 - Math.PI / 2;
        let endAngle = startAngle + this.wheel.config.projectorAngularSectionWidth;

        let width = this.ctx.canvas.width;
        let height = this.ctx.canvas.height;
        let size = Math.max(width, height) * Math.sqrt(2) * 0.9;

        this.ctx.beginPath();
        this.ctx.strokeStyle = this.wheel.config.sectionColors[this.i];
        this.ctx.lineWidth = size;
        this.ctx.arc(width / 2, height + size / 2, size, startAngle, endAngle);
        this.ctx.stroke();
    }
}

function toCartesian(cx, cy, radius, angle) {
    return {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
    };
}

function degrees(radians) {
    return (radians * 180.0) / Math.PI;
}

function radians(degrees) {
    return (degrees * Math.PI) / 180.0;
}

document.addEventListener(
    "DOMContentLoaded",
    function () {
        const wheel = new Wheel({
            // Wheel section config
            numSections: 9,
            sectionColors: [
                "#B7B7B7",
                "#FF3232",
                "#FF8C32",
                "#FFDA32",
                "#71FF83",
                "#6379FF",
                "#9663FF",
                "#FF63E9",
                "#FF6380",
            ],
            projectorAngularSectionWidth: (2 * Math.PI) / 7,

            // Wheel controls
            // false: scroll down = rotate CCW
            invertScroll: false,
            startingIndex: 0,

            // Time (ms) to lock controls after a rotation
            controlLockDuration: 500,

            // Animation
            animEasing: "outElastic(1, 0.5)",
            animWheelDuration: 1000,
            animProjectorDuration: 1300,
        });

        new Projector(wheel);
        wheel.createControls();
    },
    false
);
