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

            const content = document.getElementById("content-" + this.selectedIndex);
            if (!content || !content.contains(e.target)) {
                let delta = e.x < window.innerWidth / 2 ? -1 : 1;
                this.rotateSections(delta);
            }
        };
        document.onwheel = (e) => {
            if (this.lockControls) return;

            const content = document.getElementById("content-" + this.selectedIndex);
            if (!content || !content.contains(e.target)) {
                if (e.deltaY !== 0) {
                    let delta = e.deltaY > 0 ? 1 : -1;
                    if (this.config.invertScroll) delta = -delta;
                    this.rotateSections(delta);
                }
            }
        };
        document.onkeydown = (e) => {
            if (this.lockControls) return;

            if (e.key === "ArrowLeft") this.rotateSections(-1);
            else if (e.key === "ArrowRight") this.rotateSections(1);
        };
    }

    rotateSections(direction) {
        // Prevent fast rotations
        if (this.config.controlLockDuration > 0) {
            this.lockControls = true;
            setTimeout(() => {
                this.lockControls = false;
            }, this.config.controlLockDuration);
        }

        const numSections = this.config.numSections;

        const oldIndex = this.selectedIndex;
        this.selectedIndex = (this.selectedIndex + direction + numSections) % numSections;
        let oldRot = this.getRotation(oldIndex);
        let newRot = this.getRotation(this.selectedIndex);

        // make sure it rotates in the closest direction
        if (newRot - oldRot > Math.PI) oldRot += Math.PI * 2;
        else if (oldRot - newRot > Math.PI) newRot += Math.PI * 2;

        if (this.anim) this.anim.cancel();
        this.anim = animate(this.img, {
            rotate: [360 - degrees(oldRot), 360 - degrees(newRot)],
            duration: this.config.animWheelDuration,
            ease: this.config.animEasing,
        });
        this.projector.animateRotation(direction);
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
        this.rotation = 0;
        this.progress = 100;
        this.anim = null;

        // create sections
        this.sections = [];
        this.createSections();

        this.canvasWidth = 0;
        this.canvasHeight = 0;

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

        this.ctx.fillStyle = this.wheel.config.sectionColors[left] ?? "white";
        this.ctx.fillRect(0, 0, width / 2, height);
        this.ctx.fillStyle = this.wheel.config.sectionColors[right] ?? "white";
        this.ctx.fillRect(width / 2, 0, width / 2, height);

        // Draw slice
        if (this.progress < 70) {
            this.sections[prevIndex].draw();
        } else {
            this.sections[index].draw();
        }
    }

    resizeCanvas() {
        this.canvasWidth = window.innerWidth;
        this.canvasHeight = window.innerHeight;

        this.ctx.canvas.width = this.canvasWidth;
        this.ctx.canvas.height = this.canvasHeight;

        this.requestDraw();
    }

    animateRotation(direction) {
        const index = this.wheel.selectedIndex;
        const numSections = this.wheel.config.numSections;
        const angularWidth = this.wheel.config.projectorAngularSectionWidth;
        const startRot = direction == 1 ? angularWidth : -angularWidth;

        if (this.anim) this.anim.cancel();
        this.anim = animate(this, {
            rotation: [startRot, 0],
            progress: [0, 100],
            duration: this.wheel.config.animProjectorDuration,
            onUpdate: () => this.draw(direction),
            ease: this.wheel.config.animEasing,
        });

        const oldIndex = (index - direction + numSections) % numSections;
        this.sections[oldIndex].animateOut(direction);
        this.sections[index].animateIn(direction);
    }

    getRadius() {
        return Math.max(this.canvasHeight, this.canvasWidth) * Math.sqrt(2) * 0.9;
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
                translateX: {
                    from: 1000 * direction,
                    to: 0,
                    ease: this.wheel.config.animEasing,
                },
                opacity: {
                    from: 0,
                    to: 1,
                    ease: this.wheel.config.animOpacityInEasing,
                },
                duration: this.wheel.config.animProjectorDuration,
            });
        }
    }

    animateOut(direction) {
        if (this.anim) this.anim.cancel();

        if (this.content) {
            this.anim = animate(this.content, {
                translateX: {
                    from: 0,
                    to: -1000 * direction,
                    ease: this.wheel.config.animEasing,
                },
                opacity: {
                    from: 1,
                    to: 0,
                    ease: this.wheel.config.animOpacityOutEasing,
                },
                duration: this.wheel.config.animProjectorDuration,
                onComplete: () => this.content.classList.add("d-none"),
            });
        }
    }

    draw() {
        const numSections = this.wheel.config.numSections;
        const angularWidth = this.wheel.config.projectorAngularSectionWidth;

        const forward = (this.i - this.wheel.selectedIndex + numSections) % numSections;
        const backward = (this.wheel.selectedIndex - this.i + numSections) % numSections;
        const indexDiff = forward <= backward ? forward : -backward;

        const startAngle =
            this.proj.rotation + angularWidth * indexDiff - angularWidth / 2 - Math.PI / 2;
        const endAngle = startAngle + angularWidth;

        const width = this.proj.canvasWidth;
        const height = this.proj.canvasHeight;
        const radius = this.proj.getRadius();

        this.ctx.beginPath();
        this.ctx.strokeStyle = this.wheel.config.sectionColors[this.i] ?? "white";
        this.ctx.lineWidth = radius;
        this.ctx.arc(width / 2, height + radius / 2, radius, startAngle, endAngle);
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

function submitPassword(e) {
    e.preventDefault();
    const input = document.getElementById("pwd-input");

    if (input.value === "ModernOverMike1930?") {
        document.getElementById("content-2-pwd").classList.add("d-none");
        document.getElementById("content-2-body").classList.remove("d-none");
    } else {
        input.value = "";
    }
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
            animOpacityInEasing: "out(8)",
            animOpacityOutEasing: "out(15)",
            animWheelDuration: 1000,
            animProjectorDuration: 1300,
        });

        new Projector(wheel);
        wheel.createControls();

        // password protect content 2
        document.getElementById("pwd-form").onsubmit = submitPassword;
        // next buttons
        document.querySelectorAll(".next-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                wheel.rotateSections(1);
            });
        });
    },
    false
);
