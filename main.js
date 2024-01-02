class Wheel {
    constructor(config) {
        this.img = document.getElementById("wheel");
        this.config = config;
        this.projector = null;

        this.angularSectionWidth = (2 * Math.PI) / this.config.numSections;
        this.selectedIndex = 0;
    }

    createAnimations() {
        document.onclick = (e) => {
            let content = document.getElementById("content-" + this.selectedIndex);
            if (!content || !content.contains(e.target)) {
                let delta = e.x < window.innerWidth / 2 ? -1 : 1;
                this.rotateSectionsBy(delta);
            }
        };
        document.onwheel = (e) => {
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
            if (e.key === "ArrowLeft") this.rotateSectionsBy(-1);
            else if (e.key === "ArrowRight") this.rotateSectionsBy(1);
        };
    }

    rotateToSection(index) {
        let oldIndex = this.selectedIndex;
        let oldRot = this.getRotation(oldIndex);
        let newRot = this.getRotation(index);
        this.selectedIndex = index;

        // make sure it rotates in the closest direction
        if (newRot - oldRot > Math.PI) oldRot += Math.PI * 2;
        else if (oldRot - newRot > Math.PI) newRot += Math.PI * 2;

        anime({
            targets: this.img,
            rotate: [360 - degrees(oldRot), 360 - degrees(newRot)],
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

        // useful stuff
        this.radius = 0;
        this.rotation = 0;

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

    redraw() {
        window.requestAnimationFrame(() => this.draw());
    }

    draw() {
        const drawDist = 1;
        let index = this.wheel.selectedIndex - drawDist;
        if (index < 0) index += this.sections.length;

        for (let i = 0; i < drawDist * 2 + 1; i++) {
            this.sections[(index + i) % this.sections.length].draw();
        }
    }

    resizeCanvas() {
        this.ctx.canvas.width = window.innerWidth;
        this.ctx.canvas.height = window.innerHeight;

        this.redraw();
    }

    animateRotation(oldIndex, newIndex, oldRot, newRot) {
        anime({
            targets: this,
            rotation: [oldRot, newRot],
            duration: 1300,
            update: () => {
                this.redraw();
            },
        });

        let direction = newRot > oldRot ? 1 : -1;
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
        if (this.content && i > 0) {
            this.content.style.opacity = "0";
            this.content.classList.add("d-none");
        }
    }

    animateIn(direction) {
        if (this.animDir) {
            this.anim = null;
        }
        if (this.content) {
            this.animDir = "in";
            this.content.classList.remove("d-none");
            this.anim = anime({
                targets: this.content,
                translateX: [1000 * direction, 0],
                opacity: [0, 1],
                duration: 1300,
            });
        }
    }

    animateOut(direction) {
        if (this.animDir) {
            this.animDir = null;
        }
        if (this.content) {
            this.animDir = "out";
            anime({
                targets: this.content,
                translateX: [0, -1000 * direction],
                opacity: [1, 0],
                duration: 1300,
                complete: () => {
                    if (this.animDir === "out") {
                        this.content.classList.add("d-none");
                    }
                },
            });
        }
    }

    draw() {
        let rot = this.wheel.getRotation(this.i) - this.proj.rotation;
        let startAngle = rot - this.wheel.angularSectionWidth / 2 - Math.PI / 2;
        let endAngle = startAngle + this.wheel.angularSectionWidth;

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
            numSections: 7,
            sectionColors: [
                "#B7B7B7",
                "#FF3232",
                "#FF8C32",
                "#FFDA32",
                "#71FF83",
                "#6379FF",
                "#9663FF",
            ],

            // Wheel controls
            // false: scroll down = rotate CCW
            invertScroll: false,
        });

        const projector = new Projector(wheel);

        wheel.createAnimations();
    },
    false
);
