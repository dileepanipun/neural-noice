const containerEl = document.querySelector(".container");
const canvasEl = document.querySelector("canvas#neuro");
const devicePixelRatio = Math.min(window.devicePixelRatio, 2);


const pointer = {
    x: 0,
    y: 0,
    tX: 0,
    tY: 0,
};


let uniforms;
let gl;

document.addEventListener('DOMContentLoaded', () => {
    (async function init() {
        try {
            gl = await initShader();
            setupEvents();
            resizeCanvas();
            
            const debouncedResize = debounce(resizeCanvas, 250);
            window.addEventListener("resize", debouncedResize);
            
            requestAnimationFrame(render);
        } catch (error) {
            console.error('Initialization failed:', error);
        }
    })();
});

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

async function initShader() {
    const vsSource = await loadShader('shaders/vertex.glsl');
    const fsSource = await loadShader('shaders/fragment.glsl');

    const gl = canvasEl.getContext("webgl") || canvasEl.getContext("experimental-webgl");

    if (!gl) {
        alert("WebGL is not supported by your browser.");
    }

    function createShader(gl, sourceCode, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, sourceCode);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    const vertexShader = createShader(gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = createShader(gl, fsSource, gl.FRAGMENT_SHADER);

    function createShaderProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Unable to initialize the shader program: " + gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    const shaderProgram = createShaderProgram(gl, vertexShader, fragmentShader);
    uniforms = getUniforms(shaderProgram);

    function getUniforms(program) {
        let uniforms = [];
        let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
            let uniformName = gl.getActiveUniform(program, i).name;
            uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
        }
        return uniforms;
    }

    const vertices = new Float32Array([-1., -1., 1., -1., -1., 1., 1., 1.]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.useProgram(shaderProgram);

    const positionLocation = gl.getAttribLocation(shaderProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    return gl;
}

function render() {
    const currentTime = performance.now();

    const rafId = requestAnimationFrame(render);

    const dx = pointer.tX - pointer.x;
    const dy = pointer.tY - pointer.y;
    pointer.x += dx * 0.5;
    pointer.y += dy * 0.5;

    gl.uniform1f(uniforms.u_time, currentTime);
    gl.uniform2f(
        uniforms.u_pointer_position, 
        pointer.x / window.innerWidth, 
        1 - pointer.y / window.innerHeight
    );
    gl.uniform1f(
        uniforms.u_scroll_progress, 
        window.pageYOffset / (2 * window.innerHeight)
    );

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function resizeCanvas() {
    canvasEl.width = window.innerWidth * devicePixelRatio;
    canvasEl.height = window.innerHeight * devicePixelRatio;
    gl.uniform1f(uniforms.u_ratio, canvasEl.width / canvasEl.height);
    gl.viewport(0, 0, canvasEl.width, canvasEl.height);
}

function setupEvents() {
    function updateMousePosition(clientX, clientY) {
        pointer.tX = clientX;
        pointer.tY = clientY;
    }

    const events = {
        pointermove: e => updateMousePosition(e.clientX, e.clientY),
        touchmove: e => {
            e.preventDefault();
            const touch = e.targetTouches[0];
            updateMousePosition(touch.clientX, touch.clientY);
        },
        click: e => updateMousePosition(e.clientX, e.clientY)
    };

    Object.entries(events).forEach(([event, handler]) => {
        window.addEventListener(event, handler, { passive: event === 'touchmove' ? false : true });
    });
}
