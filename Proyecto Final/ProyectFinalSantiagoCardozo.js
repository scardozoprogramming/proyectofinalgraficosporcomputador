/* ProyectFinalSantiagoCardozo.js
   WebGL1 - Diorama + iluminación:
   1 Gouraud
   2 Phong
   3 Blinn-Phong
   4 Spotlight toggle
   5 Fog toggle
   6 Toon toggle
   P Perspectiva/Orto
   Mouse drag: orbitar
   Wheel: zoom
*/

(function () {
    const canvas = document.getElementById("glcanvas");
    const hud = document.getElementById("hud");
    const gl = canvas.getContext("webgl");
    if (!gl) { alert("WebGL no disponible"); return; }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0.03, 0.03, 0.05, 1.0);

    // ---------- Shaders ----------
    function getShaderSource(id) {
        const el = document.getElementById(id);
        return el ? el.text.trim() : "";
    }

    function compileShader(type, src) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(sh));
            throw new Error("Shader compile error");
        }
        return sh;
    }

    function createProgram(vsId, fsId) {
        const vs = compileShader(gl.VERTEX_SHADER, getShaderSource(vsId));
        const fs = compileShader(gl.FRAGMENT_SHADER, getShaderSource(fsId));
        const p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(p));
            throw new Error("Program link error");
        }
        return p;
    }

    function getLocs(program) {
        return {
            program,
            aPos: gl.getAttribLocation(program, "aPos"),
            aNor: gl.getAttribLocation(program, "aNor"),

            uModel: gl.getUniformLocation(program, "uModel"),
            uView: gl.getUniformLocation(program, "uView"),
            uProj: gl.getUniformLocation(program, "uProj"),
            uNormalMat: gl.getUniformLocation(program, "uNormalMat"),

            uLightPos: gl.getUniformLocation(program, "uLightPos"),
            uLa: gl.getUniformLocation(program, "uLa"),
            uLd: gl.getUniformLocation(program, "uLd"),
            uLs: gl.getUniformLocation(program, "uLs"),

            uKa: gl.getUniformLocation(program, "uKa"),
            uKd: gl.getUniformLocation(program, "uKd"),
            uKs: gl.getUniformLocation(program, "uKs"),
            uAlpha: gl.getUniformLocation(program, "uAlpha"),

            uUseSpot: gl.getUniformLocation(program, "uUseSpot"),
            uSpotDir: gl.getUniformLocation(program, "uSpotDir"),
            uCutoffDeg: gl.getUniformLocation(program, "uCutoffDeg"),
            uSpotExp: gl.getUniformLocation(program, "uSpotExp"),

            uKc: gl.getUniformLocation(program, "uKc"),
            uKl: gl.getUniformLocation(program, "uKl"),
            uKq: gl.getUniformLocation(program, "uKq"),

            // Solo en fs_lit
            uSpecModel: gl.getUniformLocation(program, "uSpecModel"),
            uUseToon: gl.getUniformLocation(program, "uUseToon"),
            uUseFog: gl.getUniformLocation(program, "uUseFog"),
            uFogColor: gl.getUniformLocation(program, "uFogColor"),
            uFogStart: gl.getUniformLocation(program, "uFogStart"),
            uFogEnd: gl.getUniformLocation(program, "uFogEnd"),
        };
    }

    const progG = getLocs(createProgram("vs_gouraud", "fs_gouraud"));
    const progL = getLocs(createProgram("vs_lit", "fs_lit"));

    // ---------- Geometry ----------
    function createMesh(positions, normals, indices) {
        const vboPos = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const vboNor = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vboNor);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        const ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        return { vboPos, vboNor, ibo, indexCount: indices.length };
    }

    function makePlane(size = 14.0) {
        const s = size;
        const pos = [
            -s, 0, -s, s, 0, -s, s, 0, s, -s, 0, s
        ];
        const nor = [
            0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0
        ];
        const idx = [0, 1, 2, 0, 2, 3];
        return createMesh(pos, nor, idx);
    }

    function makeCube() {
        // Caras separadas para normales correctas
        const p = [];
        const n = [];
        const idx = [];
        let v = 0;

        function face(nx, ny, nz, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
            p.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
            for (let i = 0; i < 4; i++) n.push(nx, ny, nz);
            idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
            v += 4;
        }

        // +Z
        face(0, 0, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1);
        // -Z
        face(0, 0, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1);
        // +X
        face(1, 0, 0, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1);
        // -X
        face(-1, 0, 0, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1);
        // +Y
        face(0, 1, 0, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1);
        // -Y
        face(0, -1, 0, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1);

        return createMesh(p, n, idx);
    }

    const meshPlane = makePlane(14.0);
    const meshCube = makeCube();

    // ---------- Matrices (glMatrix ya está en tu HTML) ----------
    const mat4 = glMatrix.mat4;
    const mat3 = glMatrix.mat3;
    const vec3 = glMatrix.vec3;

    const V = mat4.create();
    const P = mat4.create();
    const N = mat3.create();

    // ---------- Camera orbit ----------
    let yaw = -0.8, pitch = -0.35;
    let radius = 18.0;
    let dragging = false, lastX = 0, lastY = 0;

    canvas.addEventListener("mousedown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener("mouseup", () => dragging = false);
    window.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        const dx = (e.clientX - lastX) * 0.01;
        const dy = (e.clientY - lastY) * 0.01;
        lastX = e.clientX; lastY = e.clientY;
        yaw += dx;
        pitch += dy;
        pitch = Math.max(-1.2, Math.min(0.2, pitch));
    });

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        radius += e.deltaY * 0.01;
        radius = Math.max(6.0, Math.min(40.0, radius));
    }, { passive: false });

    // ---------- Toggles ----------
    let renderMode = 1; // 1 Gouraud, 2 Phong, 3 Blinn
    let useSpot = false;
    let useFog = false;
    let useToon = false;
    let usePerspective = true;

    window.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (k === "1") renderMode = 1;
        if (k === "2") renderMode = 2;
        if (k === "3") renderMode = 3;
        if (k === "4") useSpot = !useSpot;
        if (k === "5") useFog = !useFog;
        if (k === "6") useToon = !useToon;
        if (k === "p") usePerspective = !usePerspective;
    });

    // ---------- Scene objects ----------
    const objects = [];
    function addObject(mesh, model, mat) {
        objects.push({ mesh, model, mat });
    }

    // Material helper
    function mat(Ka, Kd, Ks, alpha) {
        return {
            Ka: new Float32Array(Ka),
            Kd: new Float32Array(Kd),
            Ks: new Float32Array(Ks),
            alpha
        };
    }

    // Suelo
    addObject(meshPlane, mat4.create(), mat(
        [0.06, 0.06, 0.06],
        [0.25, 0.25, 0.28],
        [0.02, 0.02, 0.02],
        8.0
    ));

    // Edificios (cubos escalados)
    function building(x, z, sx, sy, sz, shiny = false) {
        const m = mat4.create();
        mat4.translate(m, m, [x, sy * 0.5, z]);
        mat4.scale(m, m, [sx, sy, sz]);
        addObject(meshCube, m, mat(
            [0.05, 0.05, 0.06],
            shiny ? [0.22, 0.23, 0.25] : [0.18, 0.18, 0.20],
            shiny ? [0.85, 0.85, 0.95] : [0.10, 0.10, 0.12],
            shiny ? 64.0 : 16.0
        ));
    }

    building(-5, -2, 1.8, 4.0, 1.8, false);
    building(-2, 3, 2.2, 6.0, 2.2, true);
    building(4, -3, 2.6, 3.0, 2.0, false);
    building(5, 3, 1.6, 5.5, 1.6, true);

    // Farola (poste)
    {
        const m = mat4.create();
        mat4.translate(m, m, [2.5, 3.0, 2.5]);
        mat4.scale(m, m, [0.15, 6.0, 0.15]);
        addObject(meshCube, m, mat(
            [0.05, 0.05, 0.05],
            [0.20, 0.20, 0.20],
            [0.6, 0.6, 0.6],
            48.0
        ));
    }

    // ---------- Drawing helpers ----------
    function bindMesh(L, mesh) {
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vboPos);
        gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(L.aPos);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vboNor);
        gl.vertexAttribPointer(L.aNor, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(L.aNor);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    }

    function setModelUniforms(L, model) {
        gl.uniformMatrix4fv(L.uModel, false, model);

        // normal matrix = inv(transpose(View*Model)) 3x3
        const MV = mat4.create();
        mat4.multiply(MV, V, model);
        mat3.fromMat4(N, MV);
        mat3.invert(N, N);
        mat3.transpose(N, N);
        gl.uniformMatrix3fv(L.uNormalMat, false, N);
    }

    function setMaterial(L, m) {
        gl.uniform3fv(L.uKa, m.Ka);
        gl.uniform3fv(L.uKd, m.Kd);
        gl.uniform3fv(L.uKs, m.Ks);
        gl.uniform1f(L.uAlpha, m.alpha);
    }

    function updateCameraAndProjection() {
        const cx = Math.cos(pitch) * Math.cos(yaw) * radius;
        const cy = Math.sin(pitch) * radius + 6.0;
        const cz = Math.cos(pitch) * Math.sin(yaw) * radius;

        const eye = vec3.fromValues(cx, cy, cz);
        const center = vec3.fromValues(0, 2.0, 0);
        const up = vec3.fromValues(0, 1, 0);

        mat4.lookAt(V, eye, center, up);

        const aspect = canvas.width / canvas.height;
        if (usePerspective) {
            mat4.perspective(P, 45 * Math.PI / 180, aspect, 0.1, 100.0);
        } else {
            const s = 12.0;
            mat4.ortho(P, -s * aspect, s * aspect, -s, s, 0.1, 100.0);
        }
    }

    function setCommonUniforms(L) {
        gl.uniformMatrix4fv(L.uView, false, V);
        gl.uniformMatrix4fv(L.uProj, false, P);

        // Luz: la ponemos en WORLD y la transformamos a EC (eye coords)
        const lightWorld = vec3.fromValues(2.5, 7.0, 2.5);
        const lightEC = vec3.create();
        vec3.transformMat4(lightEC, lightWorld, V);
        gl.uniform3fv(L.uLightPos, lightEC);

        // Componentes luz
        gl.uniform3f(L.uLa, 0.10, 0.10, 0.12);
        gl.uniform3f(L.uLd, 1.00, 0.95, 0.85);
        gl.uniform3f(L.uLs, 1.00, 1.00, 1.00);

        // Spotlight dirección (WORLD->EC)
        const spotDirWorld = vec3.fromValues(-0.2, -1.0, -0.2);
        const view3 = mat3.create();
        mat3.fromMat4(view3, V);
        const spotDirEC = vec3.create();
        vec3.transformMat3(spotDirEC, spotDirWorld, view3);

        gl.uniform1i(L.uUseSpot, useSpot ? 1 : 0);
        gl.uniform3fv(L.uSpotDir, spotDirEC);
        gl.uniform1f(L.uCutoffDeg, 18.0);
        gl.uniform1f(L.uSpotExp, 24.0);

        // Atenuación
        gl.uniform1f(L.uKc, 1.0);
        gl.uniform1f(L.uKl, 0.09);
        gl.uniform1f(L.uKq, 0.032);

        // Fog (solo existe en progL)
        if (L.uUseFog) gl.uniform1i(L.uUseFog, useFog ? 1 : 0);
        if (L.uFogColor) gl.uniform3f(L.uFogColor, 0.03, 0.03, 0.05);
        if (L.uFogStart) gl.uniform1f(L.uFogStart, 8.0);
        if (L.uFogEnd) gl.uniform1f(L.uFogEnd, 28.0);

        // Toon (solo existe en progL)
        if (L.uUseToon) gl.uniform1i(L.uUseToon, useToon ? 1 : 0);
    }

    // ---------- Render loop ----------
    function draw() {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        updateCameraAndProjection();

        let L;
        if (renderMode === 1) {
            L = progG;
            gl.useProgram(L.program);
            setCommonUniforms(L);
        } else {
            L = progL;
            gl.useProgram(L.program);
            setCommonUniforms(L);

            // 0=Phong, 1=Blinn
            gl.uniform1i(L.uSpecModel, (renderMode === 3) ? 1 : 0);
        }

        for (const o of objects) {
            bindMesh(L, o.mesh);
            setModelUniforms(L, o.model);
            setMaterial(L, o.mat);
            gl.drawElements(gl.TRIANGLES, o.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        }

        const modeName = (renderMode === 1) ? "Gouraud" : (renderMode === 2) ? "Phong" : "Blinn-Phong";
        hud.textContent =
            `Modo: ${modeName} | Spot:${useSpot} | Fog:${useFog} | Toon:${useToon} | Proj:${usePerspective ? "Persp" : "Ortho"}`;

        requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
})();
