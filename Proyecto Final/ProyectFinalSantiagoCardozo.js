/* =========================================================
   ProyectFinalSantiagoCardozo.js (FINAL)
   WebGL 1.0 - Diorama + iluminación + atmósfera + cámara con ejes

   Controles:
   1 Gouraud | 2 Phong | 3 Blinn-Phong
   4 Spotlight | 5 Fog | 6 Toon | P Persp/Orto
   Mouse drag: orbitar | Wheel: zoom
   WASD: mover en X/Z | Q/E: mover en Y | Shift: más rápido
   ========================================================= */

(function () {
    const canvas = document.getElementById("glcanvas");
    const hud = document.getElementById("hud");
    const gl = canvas.getContext("webgl");
    if (!gl) { alert("WebGL no disponible"); return; }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0.03, 0.03, 0.05, 1.0);

    // ============================================================
    // Mini Math (vec3/mat4/mat3)
    // ============================================================
    const vec3 = {
        create() { return new Float32Array(3); },
        from(x, y, z) { return new Float32Array([x, y, z]); },
        add(out, a, b) { out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2]; return out; },
        sub(out, a, b) { out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2]; return out; },
        cross(out, a, b) {
            const ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2];
            out[0] = ay * bz - az * by; out[1] = az * bx - ax * bz; out[2] = ax * by - ay * bx;
            return out;
        },
        dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
        len(a) { return Math.hypot(a[0], a[1], a[2]); },
        norm(out, a) {
            const l = vec3.len(a);
            if (l > 1e-8) { out[0] = a[0] / l; out[1] = a[1] / l; out[2] = a[2] / l; }
            return out;
        },
        transformMat4(out, a, m) {
            const x = a[0], y = a[1], z = a[2];
            out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
            out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
            out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
            return out;
        },
        transformMat3(out, a, m) {
            const x = a[0], y = a[1], z = a[2];
            out[0] = m[0] * x + m[3] * y + m[6] * z;
            out[1] = m[1] * x + m[4] * y + m[7] * z;
            out[2] = m[2] * x + m[5] * y + m[8] * z;
            return out;
        }
    };

    const mat4 = {
        create() {
            const m = new Float32Array(16);
            m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
            return m;
        },
        multiply(out, a, b) {
            const o = new Float32Array(16);
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    o[c + r * 4] =
                        a[r * 4 + 0] * b[c + 0] +
                        a[r * 4 + 1] * b[c + 4] +
                        a[r * 4 + 2] * b[c + 8] +
                        a[r * 4 + 3] * b[c + 12];
                }
            }
            out.set(o);
            return out;
        },
        translate(out, a, v) {
            const t = mat4.create();
            t[12] = v[0]; t[13] = v[1]; t[14] = v[2];
            return mat4.multiply(out, a, t);
        },
        scale(out, a, v) {
            const s = mat4.create();
            s[0] = v[0]; s[5] = v[1]; s[10] = v[2];
            return mat4.multiply(out, a, s);
        },
        perspective(out, fovy, aspect, near, far) {
            const f = 1.0 / Math.tan(fovy / 2);
            out.fill(0);
            out[0] = f / aspect;
            out[5] = f;
            out[11] = -1;
            out[10] = (far + near) / (near - far);
            out[14] = (2 * far * near) / (near - far);
            return out;
        },
        ortho(out, l, r, b, t, n, f) {
            out.fill(0);
            out[0] = 2 / (r - l);
            out[5] = 2 / (t - b);
            out[10] = -2 / (f - n);
            out[12] = -(r + l) / (r - l);
            out[13] = -(t + b) / (t - b);
            out[14] = -(f + n) / (f - n);
            out[15] = 1;
            return out;
        },
        lookAt(out, eye, center, up) {
            const f = vec3.create();
            vec3.sub(f, center, eye);
            vec3.norm(f, f);

            const s = vec3.create();
            vec3.cross(s, f, up);
            vec3.norm(s, s);

            const u = vec3.create();
            vec3.cross(u, s, f);

            out[0] = s[0]; out[4] = s[1]; out[8] = s[2]; out[12] = 0;
            out[1] = u[0]; out[5] = u[1]; out[9] = u[2]; out[13] = 0;
            out[2] = -f[0]; out[6] = -f[1]; out[10] = -f[2]; out[14] = 0;
            out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;

            const t = mat4.create();
            t[12] = -eye[0]; t[13] = -eye[1]; t[14] = -eye[2];
            return mat4.multiply(out, out, t);
        }
    };

    const mat3 = {
        create() {
            const m = new Float32Array(9);
            m[0] = 1; m[4] = 1; m[8] = 1;
            return m;
        },
        fromMat4(out, m4) {
            out[0] = m4[0]; out[1] = m4[1]; out[2] = m4[2];
            out[3] = m4[4]; out[4] = m4[5]; out[5] = m4[6];
            out[6] = m4[8]; out[7] = m4[9]; out[8] = m4[10];
            return out;
        },
        invert(out, m) {
            const a00 = m[0], a01 = m[1], a02 = m[2],
                a10 = m[3], a11 = m[4], a12 = m[5],
                a20 = m[6], a21 = m[7], a22 = m[8];

            const b01 = a22 * a11 - a12 * a21;
            const b11 = -a22 * a10 + a12 * a20;
            const b21 = a21 * a10 - a11 * a20;

            let det = a00 * b01 + a01 * b11 + a02 * b21;
            if (Math.abs(det) < 1e-8) return out;
            det = 1.0 / det;

            out[0] = b01 * det;
            out[1] = (-a22 * a01 + a02 * a21) * det;
            out[2] = (a12 * a01 - a02 * a11) * det;
            out[3] = b11 * det;
            out[4] = (a22 * a00 - a02 * a20) * det;
            out[5] = (-a12 * a00 + a02 * a10) * det;
            out[6] = b21 * det;
            out[7] = (-a21 * a00 + a01 * a20) * det;
            out[8] = (a11 * a00 - a01 * a10) * det;
            return out;
        },
        transpose(out, m) {
            const a01 = m[1], a02 = m[2], a12 = m[5];
            out[1] = m[3]; out[2] = m[6];
            out[3] = a01; out[5] = m[7];
            out[6] = a02; out[7] = a12;
            return out;
        }
    };

    // ============================================================
    // WebGL helpers
    // ============================================================
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

            // solo progL
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

    // ============================================================
    // Geometry
    // ============================================================
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
        const pos = [-s, 0, -s, s, 0, -s, s, 0, s, -s, 0, s];
        const nor = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
        const idx = [0, 1, 2, 0, 2, 3];
        return createMesh(pos, nor, idx);
    }

    function makeCube() {
        const p = [], n = [], idx = [];
        let v = 0;
        function face(nx, ny, nz, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
            p.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
            for (let i = 0; i < 4; i++) n.push(nx, ny, nz);
            idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
            v += 4;
        }
        face(0, 0, 1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1);
        face(0, 0, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1);
        face(1, 0, 0, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1);
        face(-1, 0, 0, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1);
        face(0, 1, 0, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1);
        face(0, -1, 0, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1);
        return createMesh(p, n, idx);
    }

    const meshPlane = makePlane(16.0);
    const meshCube = makeCube();

    // ============================================================
    // Scene (colores vivos)
    // ============================================================
    const objects = [];
    function material(Ka, Kd, Ks, alpha) {
        return {
            Ka: new Float32Array(Ka),
            Kd: new Float32Array(Kd),
            Ks: new Float32Array(Ks),
            alpha
        };
    }
    function addObject(mesh, model, mat) {
        objects.push({ mesh, model, mat });
    }

    // Suelo claro
    addObject(meshPlane, mat4.create(), material(
        [0.18, 0.18, 0.20],
        [0.70, 0.70, 0.75],
        [0.05, 0.05, 0.05],
        8.0
    ));

    // Edificios de colores
    function building(x, z, sx, sy, sz, Kd, shiny = false) {
        const m = mat4.create();
        mat4.translate(m, m, [x, sy * 0.5, z]);
        mat4.scale(m, m, [sx, sy, sz]);

        addObject(meshCube, m, material(
            [0.12, 0.12, 0.12],                 // Ka
            Kd,                               // Kd (color)
            shiny ? [0.9, 0.9, 0.9] : [0.25, 0.25, 0.25], // Ks
            shiny ? 96.0 : 28.0               // alpha
        ));
    }

    building(-5, -2, 1.8, 4.0, 1.8, [0.95, 0.15, 0.15], false); // rojo
    building(-2, 3, 2.2, 6.0, 2.2, [0.20, 0.45, 1.00], true); // azul shiny
    building(4, -3, 2.6, 3.0, 2.0, [0.20, 0.95, 0.35], false); // verde
    building(5, 3, 1.6, 5.5, 1.6, [1.00, 0.90, 0.25], true); // amarillo shiny

    // Farola (cian)
    {
        const m = mat4.create();
        mat4.translate(m, m, [2.5, 3.0, 2.5]);
        mat4.scale(m, m, [0.18, 6.0, 0.18]);
        addObject(meshCube, m, material(
            [0.15, 0.15, 0.15],
            [0.30, 1.00, 0.95],
            [0.85, 0.85, 0.85],
            64.0
        ));
    }

    // ============================================================
    // Camera (orbit + move axes)
    // ============================================================
    // Inicial: escena completa visible
    let yaw = -0.6;
    let pitch = -0.25;
    let radius = 30.0;

    let dragging = false;
    let lastX = 0, lastY = 0;

    // Traslación en ejes
    const camOffset = vec3.from(0, 0, 0);

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
        radius = Math.max(8.0, Math.min(80.0, radius));
    }, { passive: false });

    // ============================================================
    // Toggles + movement input
    // ============================================================
    let renderMode = 1;          // 1 Gouraud, 2 Phong, 3 Blinn
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

        // Movimiento en ejes (world axes)
        const fast = e.shiftKey ? 1.6 : 1.0;
        const speed = 0.6 * fast;

        if (k === "w") camOffset[2] -= speed;
        if (k === "s") camOffset[2] += speed;
        if (k === "a") camOffset[0] -= speed;
        if (k === "d") camOffset[0] += speed;
        if (k === "q") camOffset[1] += speed;
        if (k === "e") camOffset[1] -= speed;
    });

    // ============================================================
    // Matrices
    // ============================================================
    const V = mat4.create();
    const P = mat4.create();
    const NM = mat3.create();

    function updateCameraAndProjection() {
        // Orbit around center + offset
        const cx = Math.cos(pitch) * Math.cos(yaw) * radius;
        const cy = Math.sin(pitch) * radius + 6.0;
        const cz = Math.cos(pitch) * Math.sin(yaw) * radius;

        const eye = vec3.from(
            cx + camOffset[0],
            cy + camOffset[1],
            cz + camOffset[2]
        );

        const center = vec3.from(
            camOffset[0],
            2.0 + camOffset[1],
            camOffset[2]
        );

        const up = vec3.from(0, 1, 0);
        mat4.lookAt(V, eye, center, up);

        const aspect = canvas.width / canvas.height;
        if (usePerspective) {
            mat4.perspective(P, 45 * Math.PI / 180, aspect, 0.1, 120.0);
        } else {
            const s = 14.0;
            mat4.ortho(P, -s * aspect, s * aspect, -s, s, 0.1, 120.0);
        }
    }

    // ============================================================
    // Uniforms & drawing
    // ============================================================
    function bindMesh(L, mesh) {
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vboPos);
        gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(L.aPos);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vboNor);
        gl.vertexAttribPointer(L.aNor, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(L.aNor);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    }

    function setModelAndNormal(L, model) {
        gl.uniformMatrix4fv(L.uModel, false, model);
        gl.uniformMatrix4fv(L.uView, false, V);
        gl.uniformMatrix4fv(L.uProj, false, P);

        // normal matrix = inv(transpose(MV)) 3x3
        const MV = mat4.create();
        mat4.multiply(MV, V, model);
        mat3.fromMat4(NM, MV);
        mat3.invert(NM, NM);
        mat3.transpose(NM, NM);
        gl.uniformMatrix3fv(L.uNormalMat, false, NM);
    }

    function setMaterial(L, m) {
        gl.uniform3fv(L.uKa, m.Ka);
        gl.uniform3fv(L.uKd, m.Kd);
        gl.uniform3fv(L.uKs, m.Ks);
        gl.uniform1f(L.uAlpha, m.alpha);
    }

    function setLighting(L) {
        // Luz en WORLD -> Eye coords
        const lightWorld = vec3.from(2.5, 7.5, 2.5);
        const lightEC = vec3.create();
        vec3.transformMat4(lightEC, lightWorld, V);

        // Dirección del spot en WORLD -> Eye coords
        const spotDirWorld = vec3.from(-0.2, -1.0, -0.2);
        const view3 = mat3.create();
        mat3.fromMat4(view3, V);
        const spotDirEC = vec3.create();
        vec3.transformMat3(spotDirEC, spotDirWorld, view3);
        vec3.norm(spotDirEC, spotDirEC);

        gl.uniform3fv(L.uLightPos, lightEC);

        // Más ambiente para visibilidad
        gl.uniform3f(L.uLa, 0.25, 0.25, 0.28);
        gl.uniform3f(L.uLd, 1.00, 0.98, 0.90);
        gl.uniform3f(L.uLs, 1.00, 1.00, 1.00);

        gl.uniform1i(L.uUseSpot, useSpot ? 1 : 0);
        gl.uniform3fv(L.uSpotDir, spotDirEC);
        gl.uniform1f(L.uCutoffDeg, 18.0);
        gl.uniform1f(L.uSpotExp, 24.0);

        // Atenuación suave (para que no se apague todo)
        gl.uniform1f(L.uKc, 1.0);
        gl.uniform1f(L.uKl, 0.04);
        gl.uniform1f(L.uKq, 0.01);

        // Solo progL tiene estos uniforms
        if (L.uSpecModel) gl.uniform1i(L.uSpecModel, (renderMode === 3) ? 1 : 0);
        if (L.uUseToon) gl.uniform1i(L.uUseToon, useToon ? 1 : 0);
        if (L.uUseFog) gl.uniform1i(L.uUseFog, useFog ? 1 : 0);
        if (L.uFogColor) gl.uniform3f(L.uFogColor, 0.03, 0.03, 0.05);
        if (L.uFogStart) gl.uniform1f(L.uFogStart, 10.0);
        if (L.uFogEnd) gl.uniform1f(L.uFogEnd, 55.0);
    }

    // ============================================================
    // Render loop
    // ============================================================
    function draw() {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        updateCameraAndProjection();

        let L;
        if (renderMode === 1) {
            L = progG;
        } else {
            L = progL;
        }
        gl.useProgram(L.program);

        setLighting(L);

        for (const o of objects) {
            bindMesh(L, o.mesh);
            setModelAndNormal(L, o.model);
            setMaterial(L, o.mat);
            gl.drawElements(gl.TRIANGLES, o.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        }

        const modeName = (renderMode === 1) ? "Gouraud" : (renderMode === 2) ? "Phong" : "Blinn-Phong";
        hud.textContent =
            `Modo:${modeName} | Spot:${useSpot} | Fog:${useFog} | Toon:${useToon} | Proj:${usePerspective ? "Persp" : "Ortho"} | Offset: (${camOffset[0].toFixed(1)},${camOffset[1].toFixed(1)},${camOffset[2].toFixed(1)})`;

        requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
})();
