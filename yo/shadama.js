function ShadamaFactory(threeRenderer) {
    var TEXTURE_SIZE = 1024;
    var FIELD_WIDTH = 512;
    var FIELD_HEIGHT = 512;

    var T = TEXTURE_SIZE;
    var FW = FIELD_WIDTH;
    var FH = FIELD_HEIGHT;
    // need to change this so that you can have different Shadma instances with different sizes

    var breedVAO;
    var patchVAO;
    var programs = {};  // {name: {prog: shader, vao: VAO, uniLocations: uniformLocs}}

    var renderer;
    var gl;
    var state;

    var targetTexture; // THREE.js texture, not WebGL texture

    var debugCanvas1;
    var debugArray;
    var debugArray1;
    var debugArray2;

    var debugTexture0;
    var debugTexture1;
    var framebufferD0;  // for debugging u8rgba texture
    var framebufferD1;  // for debugging u8rgba texture

    var framebufferT;
    var framebufferF;
    var framebufferR;
    var framebufferD;  // for three js u8rgba texture

    var shaders = {
	"copy.vert":
	`#version 300 es
	layout (location = 0) in vec2 a_position;

	void main(void) {
	    gl_Position = vec4(a_position, 0.0, 1.0);
	}`,
	"copy.frag":
	`#version 300 es
	precision highp float;

	uniform sampler2D u_value;

	out float fragColor;

	void main(void) {
	    ivec2 fc = ivec2(gl_FragCoord.s, gl_FragCoord.t);
	    fragColor = texelFetch(u_value, fc, 0).r;
	}`,
	"drawBreed.vert":
	`#version 300 es
	layout (location = 0) in vec2 a_index;

	uniform vec2 u_resolution;
	uniform float u_particleLength;
	uniform sampler2D u_x;
	uniform sampler2D u_y;

	uniform sampler2D u_r;
	uniform sampler2D u_g;
	uniform sampler2D u_b;
	uniform sampler2D u_a;

	out vec4 v_color;

	void main(void) {
	    vec2 zeroToOne = a_index / u_particleLength;
	    float x = texelFetch(u_x, ivec2(a_index), 0).r;
	    float y = texelFetch(u_y, ivec2(a_index), 0).r;
	    vec2 dPos = vec2(x, y);   // (0-resolution, 0-resolution)
	    vec2 normPos = dPos / u_resolution;  // (0-1.0, 0-1.0)
	    vec2 clipPos = normPos * 2.0 - 1.0;  // (-1.0-1.0, -1.0-1.0)
	    gl_Position = vec4(clipPos, 0, 1.0);

	    float r = texelFetch(u_r, ivec2(a_index), 0).r;
	    float g = texelFetch(u_g, ivec2(a_index), 0).r;
	    float b = texelFetch(u_b, ivec2(a_index), 0).r;
	    float a = texelFetch(u_a, ivec2(a_index), 0).r;
	    v_color = vec4(r, g, b, a);
	    gl_PointSize = 1.0;
	}`,

	"drawBreed.frag":
	`#version 300 es
	precision highp float;

	    in vec4 v_color;

	out vec4 fragColor;

	void main(void) {
	    fragColor = v_color;
	}`,

	"drawPatch.vert":
	`#version 300 es
	layout (location = 0) in vec2 a_position;

	void main(void) {
	    gl_Position = vec4(a_position, 0.0, 1.0);
	}`,

	"drawPatch.frag":
	`#version 300 es
	precision highp float;

	uniform sampler2D u_r;
	uniform sampler2D u_g;
	uniform sampler2D u_b;
	uniform sampler2D u_a;

	out vec4 fragColor;

	void main(void) {
	    ivec2 fc = ivec2(gl_FragCoord.s, gl_FragCoord.t);
	    float r = texelFetch(u_r, fc, 0).r;
	    float g = texelFetch(u_g, fc, 0).r;
	    float b = texelFetch(u_b, fc, 0).r;
	    float a = texelFetch(u_a, fc, 0).r;
	    fragColor = vec4(r, g, b, a);
	}`,

	"diffusePatch.vert":
	`#version 300 es
	layout (location = 0) in vec2 a_position;

	void main(void) {
	    gl_Position = vec4(a_position, 0.0, 1.0);
	}`,

	"diffusePatch.frag":
	`#version 300 es
	precision highp float;
	uniform sampler2D u_value;

	const float weight[9] = float[9](
	    0.077847, 0.123317, 0.077847,
	    0.123317, 0.195346, 0.123317,
	    0.077847, 0.123317, 0.077847
	);

	out float fragColor;

	void main(void) {
	    ivec2 fc = ivec2(gl_FragCoord.s, gl_FragCoord.t);
	    float v;
	    v = texelFetch(u_value, fc + ivec2(-1, -1), 0).r * weight[0];
	    v += texelFetch(u_value, fc + ivec2(-1,  0), 0).r * weight[1];
	    v += texelFetch(u_value, fc + ivec2(-1,  1), 0).r * weight[2];
	    v += texelFetch(u_value, fc + ivec2( 0, -1), 0).r * weight[3];
	    v += texelFetch(u_value, fc + ivec2( 0,  0), 0).r * weight[4];
	    v += texelFetch(u_value, fc + ivec2( 0,  1), 0).r * weight[5];
	    v += texelFetch(u_value, fc + ivec2( 1, -1), 0).r * weight[6];
	    v += texelFetch(u_value, fc + ivec2( 1,  0), 0).r * weight[7];
	    v += texelFetch(u_value, fc + ivec2( 1,  1), 0).r * weight[8];
	    v = v <= (1.0/256.0) ? 0.0 : v;
	    fragColor = v;
	}`,

	"debugPatch.vert":
	`#version 300 es
	layout (location = 0) in vec2 a_position;

	void main(void) {
	    gl_Position = vec4(a_position, 0.0, 1.0);
	}`,

	"debugPatch.frag":
	`#version 300 es
	precision highp float;
	uniform sampler2D u_value;

	out vec4 fragColor;

	void main(void) {
	    ivec2 fc = ivec2(gl_FragCoord.s, gl_FragCoord.t);
	    fragColor = texelFetch(u_value, fc, 0);
	}`,
	"debugPatch2.vert":
	`#version 300 es
	layout (location = 0) in vec2 a_position;

	void main(void) {
	    gl_Position = vec4(a_position, 0.0, 1.0);
	}`,

	"debugPatch2.frag":
	`#version 300 es
	precision highp float;

	out vec4 fragColor;

	void main(void) {
	    ivec2 fc = ivec2(gl_FragCoord.s, gl_FragCoord.t);
	    fragColor = vec4(gl_FragCoord.s / 2.0, gl_FragCoord.t / 512.0, 0, 1.0);
	}`,
	"renderBreed.vert":
	`#version 300 es
	layout (location = 0) in vec2 a_index;

	uniform mat4 mvpMatrix;
	uniform vec3 u_resolution;

	uniform sampler2D u_x;
	uniform sampler2D u_y;
	uniform sampler2D u_z;

	uniform sampler2D u_r;
	uniform sampler2D u_g;
	uniform sampler2D u_b;
	uniform sampler2D u_a;

	out vec4 v_color;

	void main(void) {
	    float x = texelFetch(u_x, ivec2(a_index), 0).r;
	    float y = texelFetch(u_y, ivec2(a_index), 0).r;
	    float z = texelFetch(u_z, ivec2(a_index), 0).r;
	    vec3 dPos = vec3(x, y, z);
	    vec3 normPos = dPos / u_resolution;
	    vec3 clipPos = (normPos * 2.0 - 1.0) * (u_resolution.x / 2.0);

	    gl_Position = mvpMatrix * vec4(clipPos, 1.0);

	    float r = texelFetch(u_r, ivec2(a_index), 0).r;
	    float g = texelFetch(u_g, ivec2(a_index), 0).r;
	    float b = texelFetch(u_b, ivec2(a_index), 0).r;
	    float a = texelFetch(u_a, ivec2(a_index), 0).r;
	    v_color = vec4(r, g, b, a);
	    gl_PointSize = 1.0;
	}`,

	"renderBreed.frag":
	`#version 300 es
	precision highp float;

	    in vec4 v_color;

	out vec4 fragColor;

	void main(void) {
	    fragColor = v_color;
	}`
    }

    function initBreedVAO() {
	var allIndices = new Array(T * T * 2);
	for (var j = 0; j < T; j++) {
            for (var i = 0; i < T; i++) {
		var ind = ((j * T) + i) * 2;
		allIndices[ind + 0] = i;
		allIndices[ind + 1] = j;
            }
	}

	breedVAO = gl.createVertexArray();
	gl.bindVertexArray(breedVAO);

	var positionBuffer = gl.createBuffer();

	var attrLocations = new Array(1);
	attrLocations[0] = 0 // gl.getAttribLocation(prog, 'a_index'); Now a_index has layout location spec

	var attrStrides = new Array(1);
	attrStrides[0] = 2;

	setBufferAttribute([positionBuffer], [allIndices], attrLocations, attrStrides);
	gl.bindVertexArray(null);
    }

    function initPatchVAO() {
	var rect = [
		-1.0,  1.0,
            1.0,  1.0,
		-1.0, -1.0,
            1.0,  1.0,
            1.0, -1.0,
		-1.0, -1.0,
	];

	patchVAO = gl.createVertexArray();
	gl.bindVertexArray(patchVAO);

	var positionBuffer = gl.createBuffer();
	var attrLocations = new Array(1);
	attrLocations[0] = 0; //gl.getAttribLocation(prog, 'a_position'); ; Now a_position has layout location spec

	var attrStrides = new Array(1);
	attrStrides[0] = 2;

	setBufferAttribute([positionBuffer], [rect], attrLocations, attrStrides);
	gl.bindVertexArray(null);
    }

    function makePrimitive(name, uniforms, vao) {
	var vs = createShader(name + ".vert", shaders[name+'.vert']);
	var fs = createShader(name + ".frag", shaders[name+'.frag']);

	var prog = createProgram(vs, fs);

	var uniLocations = {};
	uniforms.forEach(function (n) {
            uniLocations[n] = gl.getUniformLocation(prog, n);
	});

	return {program: prog, uniLocations: uniLocations, vao: vao};
    }

    function drawBreedProgram() {
	return makePrimitive("drawBreed", ["u_resolution", "u_particleLength", "u_x", "u_y", "u_r", "u_g", "u_b", "u_a"], breedVAO);
    }

    function drawPatchProgram() {
	return makePrimitive("drawPatch", ["u_a", "u_r", "u_g", "u_b"], patchVAO);
    }

    function debugPatchProgram() {
	return makePrimitive("debugPatch", ["u_value"], patchVAO);
    }

    function diffusePatchProgram() {
	return makePrimitive("diffusePatch", ["u_value"], patchVAO);
    }

    function copyProgram() {
	return makePrimitive("copy", ["u_value"], patchVAO);
    }

    function debugPatch2Program() {
	return makePrimitive("debugPatch2", [], patchVAO);
    }

    function renderBreedProgram() {
	return makePrimitive("renderBreed", ["mvpMatrix", "u_resolution", "u_x", "u_y", "u_z", "u_r", "u_g", "u_b", "u_a"], breedVAO);
    }

    function createShader(id, source) {
	var type;
	if (id.endsWith(".vert")) {
            type = gl.VERTEX_SHADER;
	} else if (id.endsWith(".frag")) {
            type = gl.FRAGMENT_SHADER;
	}

	var shader = gl.createShader(type);

	if (!source) {
            var scriptElement = document.getElementById(id);
            if(!scriptElement){return;}
            source = scriptElement.text;
	}
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
	if (success) {
            return shader;
	}

	console.log(gl.getShaderInfoLog(shader));
	alert(gl.getShaderInfoLog(shader));
	gl.deleteShader(shader);
    }

    function createProgram(vertexShader, fragmentShader) {
	var program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	var success = gl.getProgramParameter(program, gl.LINK_STATUS);
	if (success) {
            return program;
	}

	console.log(gl.getProgramInfoLog(program));
	//    alert(gl.getProgramInfoLog(program));
	gl.deleteProgram(program);
    }

    function createTexture(data, type, width, height) {
	if (!type) {
            type = gl.UNSIGNED_BYTE;
	}
	if (!width) {
            width = T;
	}
	if (!height) {
            height = T;
	}
	var tex = gl.createTexture();
	state.bindTexture(gl.TEXTURE_2D, tex);

	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, false);

	if (type == gl.UNSIGNED_BYTE) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, type, data);
	} else if (type == gl.R32F) {
            gl.texImage2D(gl.TEXTURE_2D, 0, type, width, height, 0, gl.RED, gl.FLOAT, data);
	} else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, type, data);
	}

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bindTexture(gl.TEXTURE_2D, null);
	return tex;
    }

    function makeFramebuffer(tex, format, width, height) {
	if (!format) {
            format = gl.UNSIGNED_BYTE;
	}
	if (!width) {
            width = T;
	}
	if (!height) {
            height = T;
	}
	var buffer = gl.createFramebuffer();

	gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
	state.bindTexture(gl.TEXTURE_2D, tex);

	if (format == gl.R32F) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, null);
	} else if (format == gl.UNSIGNED_BYTE) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, format, null);
	} else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, format, null);
	}
	state.bindTexture(gl.TEXTURE_2D, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	var target = new THREE.WebGLRenderTarget(width, height);
	renderer.properties.get(target).__webglFramebuffer = buffer;
	return target;
    }

    function setTargetBuffer(buffer, tex) {
	renderer.setRenderTarget(buffer);
	if (buffer) {
	    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
	}
    }

    function setTargetBuffers(buffer, tex) {
	if (!buffer) {
	    renderer.setRenderTarget(null, gl.DRAW_FRAMEBUFFER);
	    return;
	}

	var list = [];
	renderer.setRenderTarget(buffer, gl.DRAW_FRAMEBUFFER);
	for (var i = 0; i < tex.length; i++) {
            var val = gl.COLOR_ATTACHMENT0 + i;
            gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, val, gl.TEXTURE_2D, tex[i], 0);
            list.push(val);
	}
	gl.drawBuffers(list);
    }

    function setBufferAttribute(buffers, data, attrL, attrS) {
	for (var i in buffers) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers[i]);
            gl.bufferData(gl.ARRAY_BUFFER,
			  new Float32Array(data[i]), gl.STATIC_DRAW);
            gl.enableVertexAttribArray(attrL[i]);
            gl.vertexAttribPointer(attrL[i], attrS[i], gl.FLOAT, false, 0, 0);
	}
    }

    function textureCopy(obj, src, dst) {
	var prog = programs["copy"];
	var width;
	var height;
	var buffer;
	if (obj.constructor === Breed) {
            width = T;
            height = T;
            buffer = framebufferT;
	} else {
            width = FW;
            height = FH;
            buffer = framebufferR;
	}

	setTargetBuffer(buffer, dst);

	state.useProgram(prog.program);
	gl.bindVertexArray(prog.vao);

	state.setCullFace(THREE.CullFaceNone);
	state.setBlending(THREE.NoBlending);

	state.activeTexture(gl.TEXTURE0);
	state.bindTexture(gl.TEXTURE_2D, src);

	gl.uniform1i(prog.uniLocations["u_value"], 0);

	gl.drawArrays(gl.TRIANGLES, 0, 6);

	gl.flush();
	setTargetBuffer(null, null);

	gl.bindVertexArray(null);
    }

    function updateOwnVariable(obj, name, optData) {
	var width;
	var height;
	var ary;
	if (obj.constructor === Breed) {
            var width = T;
            var height = T;
	} else {
            var width = FW;
            var height = FH;
	}

	var ary = optData || new Float32Array(width * height);

	if (obj[name]) {
            gl.deleteTexture(obj[name]);
	}
	if (obj["new"+name]) {
            gl.deleteTexture(obj["new"+name]);
	}

	obj.own[name] = name;
	obj[name] = createTexture(ary, gl.R32F, width, height);
	obj["new"+name] = createTexture(ary, gl.R32F, width, height);
    }

    function removeOwnVariable(obj, name) {
	delete obj.own[name];
	if (obj[name]) {
            gl.deleteTexture(obj[name]);
            delete obj[name];
	}
	if (obj["new"+name]) {
            gl.deleteTexture(obj["new"+name]);
            delete obj["new"+name];
	}
    }

    function update(cls, name, fields, env) {
	var stringify = (obj) => {
            var type = Object.prototype.toString.call(obj);
            if (type === "[object Object]") {
		var pairs = [];
		for (var k in obj) {
                    if (!obj.hasOwnProperty(k)) continue;
                    pairs.push([k, stringify(obj[k])]);
		}
		pairs.sort((a, b) => a[0] < b[0] ? -1 : 1);
		pairs = pairs.map(v => '"' + v[0] + '":' + v[1]);
		return "{" + pairs + "}";
            }
            if (type === "[object Array]") {
		return "[" + obj.map(v => stringify(v)) + "]";
            }
            return JSON.stringify(obj);
	};

	var obj = env[name];
	if (!obj) {
            obj = new cls();
            for (var i = 0; i < fields.length; i++) {
		updateOwnVariable(obj, fields[i]);
            }
            env[name] = obj;
            return obj;
	}

	var oldOwn = obj.own;
	var toBeDeleted = [];  // [<str>]
	var toBeCreated = [];  // [<str>]
	var newOwn = {};

	// common case: when the existing own and fields are the same
	for (var i = 0; i < fields.length; i++) {
            var k = fields[i];
            newOwn[k] = k;
	}
	if (stringify(newOwn) === stringify(oldOwn)) {
            return; obj;
	}

	// other case: get things into toBeDeleted and toBeCreated, and toBeMoved
	for (var k in oldOwn) {
            if (fields.indexOf(k) < 0) {
		toBeDeleted.push(k)
            }
	}
	for (var i = 0; i < fields.length; i++) {
            var k = fields[i];
            if (!oldOwn[k]) {
		toBeCreated.push(k);
            }
	}

	toBeCreated.forEach((k) => updateOwnVariable(obj, k));
	toBeDeleted.forEach((k) => removeOwnVariable(obj, k));
    }

    function programFromTable(table, vert, frag, name) {
	return (function () {
            var debugName = name;
	    if (debugName === "clear") {
	    }
            var prog = createProgram(createShader(name + ".vert", vert),
                                     createShader(name + ".frag", frag));
            var vao = breedVAO;
            var uniLocations = {};


            var forBreed = table.forBreed;
            var viewportW = forBreed ? T : FW;
            var viewportH = forBreed ? T : FH;
            var hasPatchInput = table.hasPatchInput;

            table.defaultUniforms.forEach(function(n) {
		uniLocations[n] = gl.getUniformLocation(prog, n);
            });

            table.uniformTable.keysAndValuesDo((key, entry) => {
		var uni = table.uniform(entry);
		uniLocations[uni] = gl.getUniformLocation(prog, uni);
            });

            table.scalarParamTable.keysAndValuesDo((key, entry) => {
		var name = entry[2];
		var uni = "u_use_vector_" + name;
		uniLocations[uni] = gl.getUniformLocation(prog, uni);
		uni = "u_vector_" + name;
		uniLocations[uni] = gl.getUniformLocation(prog, uni);
		uni = "u_scalar_" + name;
		uniLocations[uni] = gl.getUniformLocation(prog, uni);
            });

            return function(objects, outs, ins, params) {
		// objects: {varName: object}
		// outs: [[varName, fieldName]]
		// ins: [[varName, fieldName]]
		// params: {shortName: value}
		if (debugName === "clear") {
		}
		var object = objects["this"];

		outs.forEach((pair) => {
                    textureCopy(objects[pair[0]],
				objects[pair[0]][pair[1]],
				objects[pair[0]]["new" + pair[1]])});

		var targets = outs.map(function(pair) {return objects[pair[0]]["new" + pair[1]]});
		if (forBreed) {
                    setTargetBuffers(framebufferT, targets);
		} else {
                    setTargetBuffers(framebufferR, targets);
		}

		state.useProgram(prog);
		gl.bindVertexArray(vao);

		state.setCullFace(THREE.CullFaceNone);
		state.setBlending(THREE.NoBlending);

		gl.uniform2f(uniLocations["u_resolution"], FW, FH);
		gl.uniform1f(uniLocations["u_particleLength"], T);

		var offset = 0;
		if (!forBreed || hasPatchInput) {
                    state.activeTexture(gl.TEXTURE0);
                    state.bindTexture(gl.TEXTURE_2D, object.x);
                    gl.uniform1i(uniLocations["u_that_x"], 0);

                    state.activeTexture(gl.TEXTURE1);
                    state.bindTexture(gl.TEXTURE_2D, object.y);
                    gl.uniform1i(uniLocations["u_that_y"], 1);
                    offset = 2;
		}

		for (var ind = 0; ind < ins.length; ind++) {
                    var pair = ins[ind];
                    var glIndex = gl.TEXTURE0 + ind + offset;
                    var k = pair[1]
                    var val = objects[pair[0]][k];
                    state.activeTexture(glIndex);
                    state.bindTexture(gl.TEXTURE_2D, val);
                    gl.uniform1i(uniLocations["u" + "_" + pair[0] + "_" + k], ind + offset);
		}

		for (var k in params) {
                    var val = params[k];
                    if (val.constructor == WebGLTexture) {
			var glIndex = gl.TEXTURE0 + ind + offset;
			state.activeTexture(glIndex);
			state.bindTexture(gl.TEXTURE_2D, val);
			gl.uniform1i(uniLocations["u_vector_" + k], ind + offset);
			ind++;
                    } else {
			gl.uniform1i(uniLocations["u_vector_" + k], 0);
			gl.uniform1f(uniLocations["u_scalar_" + k], val);
			gl.uniform1i(uniLocations["u_use_vector_" + k], 0);
                    }
		}

		//            if (forBreed) {
		//                gl.clearColor(0.0, 0.0, 0.0, 0.0);
		//                gl.clear(gl.COLOR_BUFFER_BIT);
		//            }
		gl.drawArrays(gl.POINTS, 0, object.count);
		gl.flush();
		setTargetBuffers(null, null);
		for (var i = 0; i < outs.length; i++) {
                    var pair = outs[i];
                    var o = objects[pair[0]];
                    var name = pair[1];
                    var tmp = o[name];
                    o[name] = o["new"+name];
                    o["new"+name] = tmp;
		}
		gl.bindVertexArray(null);
            }
	})();
    }

    function emptyImageData(width, height) {
	var ary = new Uint8ClampedArray(width * height * 4);
	for (var i = 0; i < width * height; i++) {
            ary[i * 4 + 0] = i;
            ary[i * 4 + 1] = 0;
            ary[i * 4 + 2] = 0;
            ary[i * 4 + 3] = 255;
	}
	return new ImageData(ary, 256, 256);
    }


    function Shadama() {
	this.env = {};	// {name: value}
	this.scripts = {};    // {name: [function, inOutParam]}
	this.statics = {};    // {name: function}
	this.steppers = {};  // {name: name}
	this.loadTime = 0.0;

	this.editor = null;
	this.parseErrorWidget = null;
	this.compilation = null;
	this.setupCode = null;
	this.programName = null;

	this.readPixelArray = null;
	this.readPixelCallback = null;

	this.initEnv(function() {
	});

	debugTexture0 = createTexture(new Float32Array(T*T*4), gl.FLOAT, T, T);
	debugTexture1 = createTexture(new Float32Array(FW*FH*4), gl.FLOAT, FW, FH);

	var tmp;
	tmp = createTexture(new Float32Array(T * T), gl.R32F, T, T);
	framebufferT = makeFramebuffer(tmp, gl.R32F, T, T);
	gl.deleteTexture(tmp);

	tmp = createTexture(new Float32Array(FW * FH), gl.R32F, FW, FH);
	framebufferR = makeFramebuffer(tmp, gl.R32F, FW, FH);
	gl.deleteTexture(tmp);

	tmp = createTexture(new Float32Array(FW*FH*4), gl.FLOAT, FW, FH);
	framebufferF = makeFramebuffer(tmp, gl.FLOAT, FW, FH);
	gl.deleteTexture(tmp);

	tmp = createTexture(new Uint8Array(FW*FH*4), gl.UNSIGNED_BYTE, FW, FH);
	framebufferD = makeFramebuffer(tmp, gl.UNSIGNED_BYTE, FW, FH);
	gl.deleteTexture(tmp);

	tmp = createTexture(new Float32Array(T*T*4), gl.FLOAT, T, T);
	framebufferD0 = makeFramebuffer(tmp, gl.FLOAT, T, T);
	gl.deleteTexture(tmp);

	tmp = createTexture(new Float32Array(FW*FH*4), gl.FLOAT, FW, FH);
	framebufferD1 = makeFramebuffer(tmp, gl.FLOAT, FW, FH);
	gl.deleteTexture(tmp);


    }

    Shadama.prototype.evalShadama = function(source) {
	// evaluates ohm compiled shadama code (js code) so that variables are
	// accessible inside the eval
	var env = this.env;
	var scripts = this.scripts;
	return eval(source);
    }

    Shadama.prototype.loadShadama = function(id, source) {
	var newSetupCode;
	var oldProgramName = this.programName;
	this.statics = {};
	this.scripts = {};
	if (!source) {
            var scriptElement = document.getElementById(id);
            if(!scriptElement){return "";}
            source = scriptElement.text;
	}
	this.cleanUpEditorState();
	var result = translate(source, "TopLevel", syntaxError);
	this.compilation = result;
	if (!result) {return "";}
	if (oldProgramName != result["_programName"]) {
            this.resetSystem();
	}
	this.programName = result["_programName"];
	delete result["_programName"];

	for (var k in result) {
            if (typeof result[k] === "string") { // static function case
		this.statics[k] = this.evalShadama(result[k]);
		if (k === "setup") {
                    newSetupCode = result[k];
		}
            } else {
		var entry = result[k];
		var js = entry[3];
		if (js[0] === "updateBreed") {
                    update(Breed, js[1], js[2], this.env);
		} else if (js[0] === "updatePatch") {
                    update(Patch, js[1], js[2], this.env);
		} else if (js[0] === "updateScript") {
                    var table = entry[0];
                    this.scripts[js[1]] = [programFromTable(table, entry[1], entry[2], js[1]),
                                      table.insAndParamsAndOuts()];
		}
            }
	}

	if (this.setupCode !== newSetupCode) {
            this.callSetup();
            this.setupCode = newSetupCode;
	}
	this.runLoop();
	return source;
    }

    Shadama.prototype.setTarget = function(aTexture) {
	targetTexture = aTexture;
    }

    webglTexture = function() {
	return targetTexture && renderer.properties.get(targetTexture).__webglTexture || null;
    }

    Shadama.prototype.setReadPixelCallback = function(func) {
	readPixelCallback = func;
    }

    Shadama.prototype.makeOnAfterRender = function() {
	var breed = this.env["Turtle"];
	return function(renderer, scene, camera, geometry, material, group) {
	    var mesh = this;
	    var projectionMatrix = camera.projectionMatrix;
	    var modelViewMatrix = mesh.modelViewMatrix;
	    var mvpMatrix = projectionMatrix.clone();
	    mvpMatrix.multiply(modelViewMatrix);
	    breed.render(mvpMatrix);
	}
    }


    Shadama.prototype.readPixels = function() {
	var width = this.FW;
	var height = this.FH;

	if (!this.readPixelArray) {
            this.readPixelArray = new Uint8Array(width * height * 4);
	}
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, this.readPixelArray);

	var clamped = new Uint8ClampedArray(readPixelArray);
	var img = new ImageData(clamped, width, height);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	return img;
    }

    Shadama.prototype.debugPatch2 = function() {
	var prog = programs["debugPatch2"];
	var t = webglTexture();

	if (t) {
	    setTargetBuffer(framebufferD, t);
	} else {
	    setTargetBuffer(null, null);
	}

	state.useProgram(prog.program);
	gl.bindVertexArray(prog.vao);
	state.setCullFace( THREE.CullFaceNone );

	state.setBlending(THREE.NormalBlending);

	gl.drawArrays(gl.TRIANGLES, 0, 6);
	gl.flush();
	state.setBlending(THREE.NoBlending);

	if (!t) {
	    setTargetBuffer(null, null);
	}

	gl.bindVertexArray(null);
    }

    Shadama.prototype.debugDisplay = function(objName, name) {
	var object = env[objName];
	var forBreed = object.constructor == Breed;
	var width = forBreed ? T : FW;
	var height = forBreed ? T : FH;

	if (!debugCanvas1) {
            debugCanvas1 = document.getElementById("debugCanvas1");
	    if (!debugCanvas1) {
		debugCanvas1 = document.createElement("canvas");
	    }
            debugCanvas1.width = width;
            debugCanvas1.height = height;
	}
	var prog = programs["debugPatch"];

	if (forBreed) {
            setTargetBuffer(framebufferD0, this.debugTexture0);
	} else {
            setTargetBuffer(framebufferD1, this.debugTexture1);
	}

	state.useProgram(prog.program);
	gl.bindVertexArray(prog.vao);

	var tex = object[name];

	state.activeTexture(gl.TEXTURE0);
	state.bindTexture(gl.TEXTURE_2D, tex);
	gl.uniform1i(prog.uniLocations["u_value"], 0);

	renderer.setClearColor(new THREE.Color(0x000000));
	renderer.clearColor();

	state.setCullFace(THREE.CullFaceNone);
	state.setBlending(THREE.NoBlending);

	gl.drawArrays(gl.TRIANGLES, 0, 6);
	gl.flush();

	debugArray = new Float32Array(width * height * 4);
	debugArray1 = new Float32Array(width * height);
	debugArray2 = new Uint8ClampedArray(width * height * 4);
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, debugArray);

	for (var i = 0; i < width * height; i++) {
            debugArray1[i] = debugArray[i * 4 + 0];
	}

	console.log(debugArray1);

	for (var i = 0; i < width * height; i++) {
            debugArray2[i * 4 + 0] = debugArray[i * 4 + 0] * 255;
            debugArray2[i * 4 + 1] = debugArray[i * 4 + 1] * 255;
            debugArray2[i * 4 + 2] = debugArray[i * 4 + 2] * 255;
            debugArray2[i * 4 + 3] = debugArray[i * 4 + 3] * 255;
	}

	var img = new ImageData(debugArray2, width, height);
	debugCanvas1.getContext("2d").putImageData(img, 0, 0);
	setTargetBuffer(null, null);

	gl.bindVertexArray(null);
    }

    Shadama.prototype.resetSystem = function() {
	this.scripts = {};
	this.statics = {};
	this.steppers = {};
	this.setupCode = null;
	this.programName = null;

	for (var o in this.env) {
            var obj = this.env[o];
            if (typeof obj == "object" && (obj.constructor == Breed || obj.constructor == Patch)) {
		for (var k in obj.own) {
                    var tex = obj[k];
                    if (tex.constructor === WebGLTexture) {
			gl.deleteTexture(obj[k]);
                    }
		}
		delete this.env[o];
            }
	}
    }

    Shadama.prototype.callSetup = function() {
	this.loadTime = window.performance.now() / 1000.0;
	this.env["time"] = 0.0;
	if (this.statics["setup"]) {
            this.statics["setup"](this.env);
	}
    }

    Shadama.prototype.initEnv = function(callback) {
	this.env.mousedown = {x: 0, y: 0};
	this.env.mousemove = {x: 0, y: 0};
	this.env.width = this.FW;
	this.env.height = this.FH;

	this.env["Display"] = new Display();

	callback();
    }



    Shadama.prototype.updateEnv = function() {
	function printNum(obj) {
            if (typeof obj !== "number") return obj;
            let str = Math.abs(obj) < 1 ? obj.toPrecision(3) : obj.toFixed(3);
            return str.replace(/\.0*$/, "");
	}
	function print(obj) {
            if (typeof obj !== "object") return printNum(obj);
            let props = Object.getOwnPropertyNames(obj)
                .filter((k)=>typeof obj[k] !== "object")
                .map((k)=>`${k}:${printNum(obj[k])}`);
            return `{${props.join(' ')}}`;
	}
	let list = Object.getOwnPropertyNames(this.env)
            .sort()
            .map((k)=>`${k}: ${print(env[k])}`);
//	envList.innerHTML = `<pre>${list.join('\n')}</pre>`;
    }

    Shadama.prototype.addEnv = function(key, asset) {
	this.env[key] = asset;
    }

    Shadama.prototype.runLoop = function() {
	if (this.statics["loop"]) {
	    this.steppers["loop"] = "loop";
	}
    }

    function Display() {
	this.clearColor = new THREE.Color(0xFFFFFFFF);
	this.otherColor = new THREE.Color(0x00000000);
    }

    Display.prototype.clear = function() {
	var t = webglTexture();
	if (t) {
	    setTargetBuffer(framebufferD, t);
	} else {
	    setTargetBuffer(null, null);
	}

	this.otherColor.copy(renderer.getClearColor());
	renderer.setClearColor(this.clearColor);
	renderer.clearColor();
	renderer.setClearColor(this.otherColor);

	if (!t) {
	    setTargetBuffer(null, null);
	}
    }

    class Breed {

	constructor(count) {
	    this.own = {};
	    this.count = count;
	}

	fillRandom(name, min, max) {
	    var ary = new Float32Array(T * T);
	    var range = max - min;
	    for (var i = 0; i < ary.length; i++) {
		ary[i] = Math.random() * range + min;
	    }
	    updateOwnVariable(this, name, ary);
	}

	fillRandomDir(xName, yName) {
	    var x = new Float32Array(T * T);
	    var y = new Float32Array(T * T);
	    for (var i = 0; i < x.length; i++) {
		var dir = Math.random() * Math.PI * 2.0;
		x[i] = Math.cos(dir);
		y[i] = Math.sin(dir);
	    }
	    updateOwnVariable(this, xName, x);
	    updateOwnVariable(this, yName, y);
	}

	fillRandomDir3(xName, yName, zName) {
	    var x = new Float32Array(T * T);
	    var y = new Float32Array(T * T);
	    var z = new Float32Array(T * T);
	    for (var i = 0; i < x.length; i++) {
		var angleY = Math.random() * Math.PI * 2.0;
		var angleX = Math.asin(Math.random() * 2.0 - 1.0);
		x[i] = Math.sin(angleX);
		y[i] = Math.cos(angleX) * Math.cos(angleY);
		z[i] = Math.cos(angleX) * Math.sin(angleY);
	    }
	    updateOwnVariable(this, xName, x);
	    updateOwnVariable(this, yName, y);
	    updateOwnVariable(this, zName, z);
	}

	fillSpace(xName, yName, xDim, yDim) {
	    this.setCount(xDim * yDim);
	    var x = new Float32Array(T * T);
	    var y = new Float32Array(T * T);

	    for (var j = 0; j < yDim; j++) {
		for (var i = 0; i < xDim; i++) {
		    var ind = xDim * j + i;
		    x[ind] = i;
		    y[ind] = j;
		}
	    }
	    updateOwnVariable(this, xName, x);
	    updateOwnVariable(this, yName, y);
	}

	fill(name, value) {
	    var x = new Float32Array(T * T);

	    for (var j = 0; j < this.count; j++) {
		x[j] = value;
	    }
	    updateOwnVariable(this, name, x);
	}

	fillImage(xName, yName, rName, gName, bName, aName, imagedata) {
	    var xDim = imagedata.width;
	    var yDim = imagedata.height;
	    this.fillSpace(xName, yName, xDim, yDim);

	    var r = new Float32Array(T * T);
	    var g = new Float32Array(T * T);
	    var b = new Float32Array(T * T);
	    var a = new Float32Array(T * T);

	    for (var j = 0; j < yDim; j++) {
		for (var i = 0; i < xDim; i++) {
		    var src = j * xDim + i;
		    var dst = (yDim - 1 - j) * xDim + i;
		    r[dst] = imagedata.data[src * 4 + 0] / 255.0;
		    g[dst] = imagedata.data[src * 4 + 1] / 255.0;
		    b[dst] = imagedata.data[src * 4 + 2] / 255.0;
		    a[dst] = imagedata.data[src * 4 + 3] / 255.0;
		}
	    }
	    updateOwnVariable(this, rName, r);
	    updateOwnVariable(this, gName, g);
	    updateOwnVariable(this, bName, b);
	    updateOwnVariable(this, aName, a);
	}

	draw() {
	    var prog = programs["drawBreed"];
	    var t = webglTexture();

	    if (t) {
		setTargetBuffer(framebufferD, t);
	    } else {
		setTargetBuffer(null, null);
	    }

	    state.useProgram(prog.program);
	    gl.bindVertexArray(prog.vao);

	    //    gl.enable(gl.BLEND);
	    //    gl.blendFunc(gl.ONE, gl.ONE);
	    state.setBlending(THREE.NormalBlending);

	    state.activeTexture(gl.TEXTURE0);
	    state.bindTexture(gl.TEXTURE_2D, this.x);
	    gl.uniform1i(prog.uniLocations["u_x"], 0);

	    state.activeTexture(gl.TEXTURE1);
	    state.bindTexture(gl.TEXTURE_2D, this.y);
	    gl.uniform1i(prog.uniLocations["u_y"], 1);

	    state.activeTexture(gl.TEXTURE2);
	    state.bindTexture(gl.TEXTURE_2D, this.r);
	    gl.uniform1i(prog.uniLocations["u_r"], 2);

	    state.activeTexture(gl.TEXTURE3);
	    state.bindTexture(gl.TEXTURE_2D, this.g);
	    gl.uniform1i(prog.uniLocations["u_g"], 3);

	    state.activeTexture(gl.TEXTURE4);
	    state.bindTexture(gl.TEXTURE_2D, this.b);
	    gl.uniform1i(prog.uniLocations["u_b"], 4);

	    state.activeTexture(gl.TEXTURE5);
	    state.bindTexture(gl.TEXTURE_2D, this.a);
	    gl.uniform1i(prog.uniLocations["u_a"], 5);

	    gl.uniform2f(prog.uniLocations["u_resolution"], FW, FH);
	    gl.uniform1f(prog.uniLocations["u_particleLength"], T);

	    gl.drawArrays(gl.POINTS, 0, this.count);
	    gl.flush();
	    state.setBlending(THREE.NoBlending);

	    if (!t) {
		setTargetBuffer(null, null);
	    }
	    gl.bindVertexArray(null);
	}

	render(mvpMatrix) {
	    var prog = programs["renderBreed"];
	    var breed = this;
	    var uniLocations = prog.uniLocations;

	    state.useProgram(prog.program);
	    gl.bindVertexArray(prog.vao);

	    state.setBlending(THREE.NormalBlending);

	    state.activeTexture(gl.TEXTURE0);
	    state.bindTexture(gl.TEXTURE_2D, breed.x);
	    gl.uniform1i(prog.uniLocations["u_x"], 0);

	    state.activeTexture(gl.TEXTURE1);
	    state.bindTexture(gl.TEXTURE_2D, breed.y);
	    gl.uniform1i(prog.uniLocations["u_y"], 1);

	    state.activeTexture(gl.TEXTURE2);
	    state.bindTexture(gl.TEXTURE_2D, breed.z);
	    gl.uniform1i(prog.uniLocations["u_z"], 2);

	    state.activeTexture(gl.TEXTURE3);
	    state.bindTexture(gl.TEXTURE_2D, this.r);
	    gl.uniform1i(prog.uniLocations["u_r"], 3);

	    state.activeTexture(gl.TEXTURE4);
	    state.bindTexture(gl.TEXTURE_2D, this.g);
	    gl.uniform1i(prog.uniLocations["u_g"], 4);

	    state.activeTexture(gl.TEXTURE5);
	    state.bindTexture(gl.TEXTURE_2D, this.b);
	    gl.uniform1i(prog.uniLocations["u_b"], 5);

	    state.activeTexture(gl.TEXTURE6);
	    state.bindTexture(gl.TEXTURE_2D, this.a);
	    gl.uniform1i(prog.uniLocations["u_a"], 6);

	    gl.uniformMatrix4fv(uniLocations["mvpMatrix"], false, mvpMatrix.elements);
	    gl.uniform3f(prog.uniLocations["u_resolution"], FW, FH, FW); // TODO

	    gl.drawArrays(gl.POINTS, 0, this.count);
	    gl.flush();
	    state.setBlending(THREE.NoBlending);

	    gl.bindVertexArray(null);
	}

	setCount(n) {
	    var oldCount = this.count;
	    if (n < 0 || !n) {
		n = 0;
	    }
	    this.count = n;
	    //
	}
    }

    class Patch {

	constructor() {
	    this.own = {};
	}

	draw() {
	    var prog = programs["drawPatch"];
	    var t = webglTexture();

	    if (t) {
		setTargetBuffer(framebufferD, t);
	    } else {
		setTargetBuffer(null, null);
	    }

	    state.useProgram(prog.program);
	    gl.bindVertexArray(prog.vao);

	    state.setBlending(THREE.NormalBlending);
	    state.setCullFace(THREE.CullFaceNone);

	    state.activeTexture(gl.TEXTURE0);
	    state.bindTexture(gl.TEXTURE_2D, this.r);
	    gl.uniform1i(prog.uniLocations["u_r"], 0);

	    state.activeTexture(gl.TEXTURE0 + 1);
	    state.bindTexture(gl.TEXTURE_2D, this.g);
	    gl.uniform1i(prog.uniLocations["u_g"], 1);

	    state.activeTexture(gl.TEXTURE0 + 2);
	    state.bindTexture(gl.TEXTURE_2D, this.b);
	    gl.uniform1i(prog.uniLocations["u_b"], 2);

	    state.activeTexture(gl.TEXTURE0 + 3);
	    state.bindTexture(gl.TEXTURE_2D, this.a);
	    gl.uniform1i(prog.uniLocations["u_a"], 3);


	    gl.drawArrays(gl.TRIANGLES, 0, 6);
	    gl.flush();
	    state.setBlending(THREE.NoBlending);

	    if (!t) {
		setTargetBuffer(null, null);
	    }

	    gl.bindVertexArray(null);
	}

	diffuse(name) {
	    var prog = programs["diffusePatch"];

	    var target = this["new"+name];
	    var source = this[name];

	    setTargetBuffer(framebufferR, target);

	    state.useProgram(prog.program);
	    gl.bindVertexArray(prog.vao);

	    state.setCullFace(THREE.CullFaceNone);
	    state.setBlending(THREE.NoBlending);

	    state.activeTexture(gl.TEXTURE0);
	    state.bindTexture(gl.TEXTURE_2D, source);
	    gl.uniform1i(prog.uniLocations["u_value"], 0);

	    gl.drawArrays(gl.TRIANGLES, 0, 6);

	    gl.flush();
	    setTargetBuffer(null, null);

	    this["new"+name] = source;
	    this[name] = target;

	    gl.bindVertexArray(null);
	};
    }

    Shadama.prototype.cleanUpEditorState = function() {
	if (this.editor) {
            if (this.parseErrorWidget) {
		this.editor.removeLineWidget(this.parseErrorWidget);
		this.parseErrorWidget = undefined;
            }
            this.editor.getAllMarks().forEach(function(mark) { mark.clear(); });
	}
    }

    function syntaxError(match, src) {
	function toDOM(x) {
            if (x instanceof Array) {
		var xNode = document.createElement(x[0]);
		x.slice(1)
                    .map(toDOM)
                    .forEach(yNode => xNode.appendChild(yNode));
		return xNode;
            } else {
		return document.createTextNode(x);
            }
	};

	if (this.editor) {
            setTimeout(
		function() {
                    if (this.editor.getValue() === src && !this.parseErrorWidget) {
			function repeat(x, n) {
                            var xs = [];
                            while (n-- > 0) {
				xs.push(x);
                            }
                            return xs.join('');
			}
			var msg = 'Expected: ' + match.getExpectedText();
			var pos = this.editor.doc.posFromIndex(match.getRightmostFailurePosition());
			var error = toDOM(['parseerror', repeat(' ', pos.ch) + '^\n' + msg]);
			this.parseErrorWidget = this.editor.addLineWidget(pos.line, error);
                    }
		},
		2500
            );
	}
    }

    Shadama.prototype.step = function() {
	this.env["time"] = (window.performance.now() / 1000) - this.loadTime;
	for (var k in this.steppers) {
            var func = this.statics[k];
            if (func) {
		func(this.env);
            }
	}
    }

    Shadama.prototype.destroy = function() {
    }

    Shadama.prototype.pointermove = function(x, y) {
	this.env.mousemove = {x: x, y: y};
    }

    Shadama.prototype.pointerup = function(x, y) {
	this.env.mouseup = {x: x, y: y};
    }

    Shadama.prototype.pointerdown = function(x, y) {
	this.env.mousedown = {x: x, y: y}
    }

    var shadamaGrammar = String.raw`
Shadama {
  TopLevel
    = ProgramDecl? (Breed | Patch | Script | Static)*

  ProgramDecl = program string
  Breed = breed ident "(" Formals ")"
  Patch = patch ident "(" Formals ")"
  Script = def ident "(" Formals ")" Block
  Static = static ident "(" Formals ")" Block

  Formals
    = ident ("," ident)* -- list
    | empty

  Block = "{" StatementList "}"

  StatementList = Statement*

  Statement
    = Block
    | VariableStatement
    | AssignmentStatement
    | ExpressionStatement
    | IfStatement
    | ExpressionStatement

  VariableStatement = var VariableDeclaration ";"
  VariableDeclaration = ident Initialiser?
  Initialiser = "=" Expression

  ExpressionStatement = Expression ";"
  IfStatement = if "(" Expression ")" Statement (else Statement)?

  AssignmentStatement
    = LeftHandSideExpression "=" Expression ";"

  LeftHandSideExpression
    = ident "." ident -- field
    | ident

  Expression = EqualityExpression

  EqualityExpression
    = EqualityExpression "==" LogicalExpression  -- equal
    | EqualityExpression "!=" LogicalExpression  -- notEqual
    | LogicalExpression

  LogicalExpression
    = LogicalExpression "&&" RelationalExpression       -- and
    | LogicalExpression "||" RelationalExpression       -- or
    | RelationalExpression

  RelationalExpression
    = RelationalExpression "<" AddExpression           -- lt
    | RelationalExpression ">" AddExpression           -- gt
    | RelationalExpression "<=" AddExpression          -- le
    | RelationalExpression ">=" AddExpression          -- ge
    | AddExpression

  AddExpression
    = AddExpression "+" MulExpression  -- plus
    | AddExpression "-" MulExpression -- minus
    | MulExpression

  MulExpression
    = MulExpression "*" PrimExpression  -- times
    | MulExpression "/" PrimExpression  -- divide
    | MulExpression "%" PrimExpression  -- mod
    | UnaryExpression

  UnaryExpression
    = "+" PrimExpression -- plus
    | "-" PrimExpression -- minus
    | "!" PrimExpression -- not
    | PrimExpression

  PrimExpression
    = "(" Expression ")"  -- paren
    | PrimitiveCall
    | MethodCall
    | PrimExpression "." ident     -- field
    | ident               -- variable
    | string              -- string
    | number              -- number

  PrimitiveCall
    = ident "(" Actuals ")"

  MethodCall
    = ident "." ident "(" Actuals ")"

  Actuals
    = Expression ("," Expression)* -- list
    | empty

  ident
    = letter (alnum | "_")*

  number
    = digit* "." digit+  -- fract
    | digit+             -- whole

  string = "\"" doubleStringCharacter* "\""

  doubleStringCharacter
    = "\\" any           -- escaped
    | ~"\"" any          -- nonEscaped

  identifierStart = letter | "_"
  identifierPart = identifierStart | digit

  var = "var" ~identifierPart
  if = "if" ~identifierPart
  breed = "breed" ~identifierPart
  patch = "patch" ~identifierPart
  else = "else" ~identifierPart
  def = "def" ~identifierPart
  this = "this" ~identifierPart
  self = "self" ~identifierPart
  static = "static" ~identifierPart
  program = "program" ~identifierPart

  empty =
  space
   += "//" (~nl any)* nl  -- cppComment
    | "/*" (~"*/" any)* "*/" -- cComment
  nl = "\n"
}
`;

    var g;
    var s;

    function initCompiler() {
	g = ohm.grammar(shadamaGrammar);
	s = g.createSemantics();
	initSemantics();
    }

    function initSemantics() {
	function addDefaults(obj) {
            obj["clear"] = new SymTable([]);
            obj["setCount"] = new SymTable([
		["param", null, "num"]]);
            obj["draw"] = new SymTable([]);
            obj["fillRandom"] = new SymTable([
		["param", null, "name"],
		["param", null, "min"],
		["param", null, "max"]]);
            obj["fillRandomDir"] = new SymTable([
		["param", null, "xDir"],
		["param", null, "yDir"]]);
            obj["fillRandomDir3"] = new SymTable([
		["param", null, "xDir"],
		["param", null, "yDir"],
		["param", null, "zDir"]]);
            obj["fillSpace"] = new SymTable([
		["param", null, "xName"],
		["param", null, "yName"],
		["param", null, "x"],
		["param", null, "y"]]);
            obj["fillImage"] = new SymTable([
		["param", null, "xName"],
		["param", null, "yName"],
		["param", null, "rName"],
		["param", null, "gName"],
		["param", null, "bName"],
		["param", null, "aName"],
		["param", null, "imageData"]]);
            obj["diffuse"] = new SymTable([
		["param", null, "name"],
	    ]);
            obj["random"] = new SymTable([
		["param", null, "seed"],
	    ]);
            obj["playSound"] = new SymTable([
		["param", null, "name"],
	    ]);
	}

	s.addOperation(
            "symTable(table)",
            {
		TopLevel(p, ds) {
                    var result = {};
                    addDefaults(result);
                    if (p.children.length > 0) {
			result = addAsSet(result, p.children[0].symTable(null));
                    }
                    for (var i = 0; i< ds.children.length; i++) {
			var d = ds.children[i].symTable(null);
			var ctor = ds.children[i].ctorName;
			if (ctor == "Script" || ctor == "Static") {
                            addAsSet(result, d);
			}
                    }
                    return result;
		},

		ProgramDecl(_p, s) {
                    return {_programName: s.sourceString.slice(1, s.sourceString.length - 1)}
		},

		Breed(_b, n, _o, fs, _c) {
                    var table = new SymTable();
                    fs.symTable(table);
                    table.process();
                    return {[n.sourceString]: table};
		},

		Patch(_p, n, _o, fs, _c) {
                    var table = new SymTable();
                    fs.symTable(table);
                    table.process();
                    return {[n.sourceString]: table};
		},

		Script(_d, n, _o, ns, _c, b) {
                    var table = new SymTable();
                    ns.symTable(table);
                    b.symTable(table);
                    table.process();
                    return {[n.sourceString]: table};
		},

		Static(_s, n, _o, ns, _c, b) {
                    var table = new SymTable();
                    ns.symTable(table);
                    table.process();
                    return {[n.sourceString]: table};
		},

		Formals_list(h, _c, r) {
                    var table = this.args.table;
                    table.add("param", null, h.sourceString);
                    for (var i = 0; i < r.children.length; i++) {
			var n = r.children[i].sourceString;
			table.add("param", null, n);
                    }
                    return table;
		},

		StatementList(ss) { // an iter node
                    var table = this.args.table;
                    for (var i = 0; i< ss.children.length; i++) {
			ss.children[i].symTable(table);
                    }
                    return table;
		},

		VariableDeclaration(n, optI) {
                    var table = this.args.table;
                    var r = {["var." + n.sourceString]: ["var", null, n.sourceString]};
                    table.add("var", null, n.sourceString);
                    if (optI.children.length > 0) {
			optI.children[0].symTable(table);
                    }
                    return table;
		},

		IfStatement(_if, _o, c, _c, t, _e, optF) {
                    var table = this.args.table;
                    c.symTable(table);
                    t.symTable(table);
                    if (optF.children.length > 0) {
			optF.children[0].symTable(table);
                    }
                    return table;
		},

		LeftHandSideExpression_field(n, _a, f) {
                    this.args.table.add("propOut", n.sourceString, f.sourceString);
                    return this.args.table;
		},
		PrimExpression_field(n, _p, f) {
                    var table = this.args.table;
                    if (!(n.ctorName === "PrimExpression" && (n.children[0].ctorName === "PrimExpression_variable"))) {
			console.log("you can only use 'this' or incoming patch name");
                    }
                    var name = n.sourceString;
                    if (!table.isBuiltin(name)) {
			table.add("propIn", n.sourceString, f.sourceString);
                    }
                    return table;
		},

		PrimExpression_variable(n) {
                    return {};//["var." + n.sourceString]: ["var", null, n.sourceString]};
		},

		PrimitiveCall(n, _o, as, _c) {
                    this.args.table.maybePrimitive(n.sourceString);
                    return as.symTable(this.args.table);
		},

		Actuals_list(h, _c, r) {
                    var table = this.args.table;
                    h.symTable(table);
                    for (var i = 0; i < r.children.length; i++) {
			r.children[i].symTable(table);
                    }
                    return table;
		},

		ident(_h, _r) {return this.args.table;},
		number(s) {return this.args.table;},
		_terminal() {return this.args.table;},
		_nonterminal(children) {
                    var table = this.args.table;
                    for (var i = 0; i < children.length; i++) {
			children[i].symTable(table);
                    }
                    return table;
		},
            });

	function transBinOp(l, r, op, args) {
            var table = args.table;
            var vert = args.vert;
            var frag = args.frag;
            vert.push("(");
            l.glsl(table, vert, frag);
            vert.push(op);
            r.glsl(table, vert, frag);
            vert.push(")");
	};

	s.addOperation(
            "glsl_script_formals",
            {
		Formals_list(h, _c, r) {
                    return [h.sourceString].concat(r.children.map((c) => c.sourceString));
		},
            });

	s.addOperation(
            "glsl_helper(table, vert, frag)",
            {
		Block(_o, ss, _c) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;

                    var patchInput = `
  float _x = texelFetch(u_that_x, ivec2(a_index), 0).r;
  float _y = texelFetch(u_that_y, ivec2(a_index), 0).r;
  vec2 _pos = vec2(_x, _y);
`;

                    var patchPrologue = `
  vec2 oneToOne = (_pos / u_resolution) * 2.0 - 1.0;
`;

                    var breedPrologue = `
  vec2 oneToOne = (a_index / u_particleLength) * 2.0 - 1.0;
`;

                    var epilogue = `
  gl_Position = vec4(oneToOne, 0.0, 1.0);
  gl_PointSize = 1.0;
`;
                    var breedEpilogue = `
  gl_Position = vec4(oneToOne, 0.0, 1.0);
  gl_PointSize = 1.0;
`;

                    vert.pushWithSpace("{\n");
                    vert.addTab();

                    if (table.hasPatchInput || !table.forBreed) {
			vert.push(patchInput);
                    }

                    if (table.forBreed) {
			vert.push(breedPrologue);
                    } else {
			vert.push(patchPrologue);
                    }

                    table.scalarParamTable.keysAndValuesDo((key, entry) => {
			var e = entry[2];
			var template1 = `float ${e} = u_use_vector_${e} ? texelFetch(u_vector_${e}, ivec2(a_index), 0).r : u_scalar_${e};`;
			vert.tab();
			vert.push(template1);
			vert.cr();
                    });

                    table.uniformDefaults().forEach(elem => {
			vert.tab();
			vert.push(elem);
			vert.cr();
                    });


                    ss.glsl(table, vert, frag);
                    vert.push(table.forBreed ? epilogue : epilogue);

                    vert.decTab();
                    vert.tab();
                    vert.push("}");
		},

		Script(_d, n, _o, ns, _c, b) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;

                    var breedPrologue =
`#version 300 es
layout (location = 0) in vec2 a_index;
uniform vec2 u_resolution;
uniform float u_particleLength;
`;

                    var patchPrologue = breedPrologue + `
uniform sampler2D u_that_x;
uniform sampler2D u_that_y;
`;

                    vert.push(table.forBreed && !table.hasPatchInput ? breedPrologue : patchPrologue);

                    table.uniforms().forEach(elem => {
			vert.push(elem);
			vert.cr();
                    });

                    table.paramUniforms().forEach(elem => {
			vert.push(elem);
			vert.cr();
                    });

                    table.vertVaryings().forEach(elem => {
			vert.push(elem);
			vert.cr();
                    });

                    vert.crIfNeeded();

                    table.primitives().forEach((n) => {
			vert.push(n);
                    });

                    vert.push("void main()");

                    // fragment head

                    frag.push("#version 300 es\n");
                    frag.push("precision highp float;\n");

                    table.fragVaryings().forEach((elem) =>{
			frag.push(elem);
			frag.cr();
                    });

                    table.outs().forEach((elem) => {
			frag.push(elem);
			frag.cr();
                    });

                    frag.crIfNeeded();
                    frag.push("void main()");

                    b.glsl_helper(table, vert, frag);

                    vert.crIfNeeded();

                    frag.pushWithSpace("{");
                    frag.cr();

                    frag.addTab();
                    table.fragColors().forEach((line) => {
			frag.tab();
			frag.push(line);
			frag.cr();
                    });
                    frag.decTab();
                    frag.crIfNeeded();
                    frag.push("}");
                    frag.cr();

                    return {[n.sourceString]: [table, vert.contents(), frag.contents(), ["updateScript", n.sourceString]]};
		}
            });

	s.addOperation(
            "glsl(table, vert, frag)",
            {
		TopLevel(p, ds) {
                    var table = this.args.table;
                    var result = {};
                    for (var i = 0; i < ds.children.length; i++) {
			var child = ds.children[i];
			if (child.ctorName == "Static") {
                            var js = new CodeStream();
                            var val = child.static(table, js, null, false);
                            addAsSet(result, val);
			} else {
                            var val = child.glsl(table, null, null);
                            addAsSet(result, val);
			}
                    }
                    result["_programName"] = table["_programName"];
                    return result;
		},

		Breed(_b, n, _o, fs, _c) {
                    var table = this.args.table;
                    var vert = new CodeStream();
                    var frag = new CodeStream();
                    var js = [];
                    js.push("updateBreed");
                    js.push(n.sourceString);
                    js.push(fs.glsl_script_formals());
                    return {[n.sourceString]: [table[n.sourceString], vert.contents(), frag.contents(), js]};
		},

		Patch(_p, n, _o, fs, _c) {
                    var table = this.args.table;
                    var vert = new CodeStream();
                    var frag = new CodeStream();
                    var js = [];
                    js.push("updatePatch");
                    js.push(n.sourceString);
                    js.push(fs.glsl_script_formals());
                    return {[n.sourceString]: [table[n.sourceString], vert.contents(), frag.contents(), js]};
		},

		Script(_d, n, _o, ns, _c, b) {
                    var inTable = this.args.table;
                    var table = inTable[n.sourceString];
                    var vert = new CodeStream();
                    var frag = new CodeStream();

                    return this.glsl_helper(table, vert, frag);
		},

		Block(_o, ss, _c) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;

                    vert.pushWithSpace("{");
                    vert.cr();
                    vert.addTab();
                    ss.glsl(table, vert, frag);
                    vert.decTab();
                    vert.tab();
                    vert.push("}");
		},

		StatementList(ss) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;
                    for (var i = 0; i < ss.children.length; i++) {
			vert.tab();
			ss.children[i].glsl(table, vert, frag);
                    }
		},

		Statement(e) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;
                    e.glsl(table, vert, frag);
                    if (e.ctorName !== "Block" && e.ctorName !== "IfStatement") {
			vert.push(";");
			vert.cr();
                    }
                    if (e.ctorName == "IfStatement") {
			vert.cr();
                    }
		},

		IfStatement(_i, _o, c, _c, t, _e, optF) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;
                    vert.pushWithSpace("if");
                    vert.pushWithSpace("(");
                    c.glsl(table, vert, frag);
                    vert.push(")");
                    t.glsl(table, vert, frag);
                    if (optF.children.length === 0) { return;}
                    vert.pushWithSpace("else");
                    optF.glsl(table, vert, frag);
		},

		AssignmentStatement(l, _a, e, _) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;
                    l.glsl(table, vert, frag);
                    vert.push(" = ");
                    e.glsl(table, vert, frag);
		},

		VariableStatement(_v, d, _s) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;
                    d.glsl(table, vert, frag);
		},

		VariableDeclaration(n, i) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;
                    vert.push("float");
                    vert.pushWithSpace(n.sourceString);
                    if (i.children.length !== 0) {
			vert.push(" = ");
			i.glsl(table, vert, frag);
                    }
		},

		Initialiser(_a, e) {
                    e.glsl(this.args.table, this.args.vert, this.args.frag);
            },

		LeftHandSideExpression_field(n, _p, f) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    vert.push(table.varying(["propOut", n.sourceString, f.sourceString]));
		},

		ExpressionStatement(e ,_s) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;
                    e.glsl(table, vert, frag);
		},

		Expression(e) {
                    e.glsl(this.args.table, this.args.vert, this.args.frag);
		},

		EqualityExpression(e) {
                    e.glsl(this.args.table, this.args.vert, this.args.frag);
		},

		EqualityExpression_equal(l, _, r) {
                    transBinOp(l, r, " == ", this.args);
		},

		EqualityExpression_notEqual(l, _, r) {
                    transBinOp(l, r, " != ", this.args);
		},

		RelationalExpression(e) {
                    e.glsl(this.args.table, this.args.vert, this.args.frag);
		},

		RelationalExpression_lt(l, _, r) {
                    transBinOp(l, r, " < ", this.args);
		},

		RelationalExpression_gt(l, _, r) {
                    transBinOp(l, r, " > ", this.args);
		},

		RelationalExpression_le(l, _, r) {
                    transBinOp(l, r, " <= ", this.args);
		},

		RelationalExpression_ge(l, _, r) {
                    transBinOp(l, r, " >= ", this.args);
		},

		LogicalExpression(e) {
                    e.glsl(this.args.table, this.args.vert, this.args.frag);
		},

		LogicalExpression_and(l, _, r) {
                    transBinOp(l, r, " && ", this.args);
		},

		LogicalExpression_or(l, _, r) {
                    transBinOp(l, r, " || ", this.args);
		},

		AddExpression(e) {
                    e.glsl(this.args.table, this.args.vert, this.args.frag);
		},

		AddExpression_plus(l, _, r) {
                    transBinOp(l, r, " + ", this.args);
		},

		AddExpression_minus(l, _, r) {
                    transBinOp(l, r, " - ", this.args);
		},

		MulExpression(e) {
                    e.glsl(this.args.table, this.args.vert, this.args.frag);
		},

		MulExpression_times(l, _, r) {
                    transBinOp(l, r, " * ", this.args);
		},

		MulExpression_divide(l, _, r) {
                    transBinOp(l, r, " / ", this.args);
		},

		MulExpression_mod(l, _, r) {
                    transBinOp(l, r, " % ", this.args);
		},

		UnaryExpression(e) {
                    e.glsl(this.args.table, this.args.vert, this.args.frag);
		},

		UnaryExpression_plus(_p, e) {
                    e.glsl(this.args.table, this.args.vert, this.args.frag);
		},

		UnaryExpression_minus(_p, e) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;
                    vert.pushWithSpace("-");
                    e.glsl(table, vert, frag);
		},

		UnaryExpression_not(_p, e) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;
                    vert.pushWithSpace("!");
                    e.glsl(table, vert, frag);
		},

		PrimExpression(e) {
                    e.glsl(this.args.table, this.args.vert, this.args.frag);
		},

		PrimExpression_paren(_o, e, _c) {
                    e.glsl(this.args.table, this.args.vert, this.args.frag);
		},

		PrimExpression_number(e) {
                    var vert = this.args.vert;
                    var ind = e.sourceString.indexOf(".");
                    if (ind < 0) {
			vert.push(e.sourceString + ".0");
                    } else {
			vert.push(e.sourceString);
                    }
		},

		PrimExpression_field(n, _p, f) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;

                    if (table.isBuiltin(n.sourceString)) {
			vert.push(n.sourceString + "." + f.sourceString);
                    } else {
			if (n.sourceString === "this") {
                            vert.push("texelFetch(" +
                                      table.uniform(["propIn", n.sourceString, f.sourceString]) +
                                      ", ivec2(a_index), 0).r");
			} else {
                            vert.push("texelFetch(" +
                                      table.uniform(["propIn", n.sourceString, f.sourceString]) +
                                      ", ivec2(_pos), 0).r");
			}
                    }
		},

		PrimExpression_variable(n) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;
                    vert.push(n.sourceString);
		},

		PrimitiveCall(n, _o, as, _c) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;
                    vert.push(n.sourceString);
                    vert.push("(");
                    as.glsl(table, vert, frag);
                    vert.push(")");
		},

		Actuals_list(h, _c, r) {
                    var table = this.args.table;
                    var vert = this.args.vert;
                    var frag = this.args.frag;
                    h.glsl(table, vert, frag);
                    for (var i = 0; i < r.children.length; i++) {
			vert.push(", ");
			r.children[i].glsl(table, vert, frag);
                    }
		},

		ident(n, rest) {
                    this.args.vert.push(this.sourceString);
		}
            });

	function staticTransBinOp(l, r, op, args) {
            var table = args.table;
            var js = args.js;
            var method = args.method;
            var isOther = args.isOther;
            js.push("(");
            l.static(table, js, method, isOther);
            js.push(op);
            r.static(table, js, method, isOther);
            js.push(")");
	};

	s.addOperation(
            "static_method_helper(table, js, method, isOther)",
            {
		Actuals_list(h, _c, r) {
                    var table = this.args.table;
                    var result = [];
                    var js = new CodeStream();
                    var method = this.args.method;

                    function isOther(i) {
			var realTable = table[method];
			if (!realTable) {return false}
			var r = realTable.usedAsOther(realTable.param.at(i)[2]);
			return r;
                    };
                    h.static(table, js, method, isOther(0));
                    result.push(js.contents());
                    for (var i = 0; i < r.children.length; i++) {
			var c = r.children[i];
			var js = new CodeStream();
			c.static(table, js, method, isOther(i+1));
			result.push(js.contents());
                    }
                    return result;
		},

		Formals_list(h, _c, r) {
                    var table = this.args.table;
                    var result = [];
                    var js = new CodeStream();

                    result.push(h.sourceString);
                    for (var i = 0; i < r.children.length; i++) {
			var c = r.children[i];
			result.push(", ");
			result.push(c.sourceString);
                    }
                    return result;
		},

		empty() {
                    return [];
		}
            });

	s.addOperation(
            "static(table, js, method, isOther)",
            {

		Static(_s, n, _o, fs, _c, b) {
                    var table = this.args.table;
                    var js = this.args.js;
                    var method = this.args.method;

                    js.push("(function");
                    js.pushWithSpace(n.sourceString);
                    js.push("(");
                    js.push(fs.static_method_helper(table, null, null, null));
                    js.push(") ");
                    b.static(table, js, method, false);
                    js.push(")");
                    return {[n.sourceString]: js.contents()};
		},

		Block(_o, ss, _c) {
                    var table = this.args.table;
                    var js = this.args.js;
                    var method = this.args.method;
                    js.pushWithSpace("{");
                    js.cr();
                    js.addTab();
                    ss.static(table, js, method, false);
                    js.decTab();
                    js.tab();
                    js.push("}");
		},

		StatementList(ss) {
                    var table = this.args.table;
                    var js = this.args.js;
                    var method = this.args.method;
                    var isOther = this.args.isOther;
                    for (var i = 0; i < ss.children.length; i++) {
			js.tab();
			ss.children[i].static(table, js, method, isOther);
                    }
		},

		Statement(e) {
                    var table = this.args.table;
                    var js = this.args.js;
                    var method = this.args.method;
                    var isOther = this.args.isOther;
                    e.static(table, js, method, isOther);
                    if (e.ctorName !== "Block" && e.ctorName !== "IfStatement") {
			js.push(";");
			js.cr();
                    }
                    if (e.ctorName == "IfStatement") {
			js.cr();
                    }
		},

		IfStatement(_i, _o, c, _c, t, _e, optF) {
                    var table = this.args.table;
                    var js = this.args.js;
                    var method = this.args.method;
                    var isOther = this.args.isOther;
                    js.push("if");
                    js.pushWithSpace("(");
                    c.static(table, js, method, isOther);
                    js.push(")");
                    t.static(table, js, method, isOther);
                    if (optF.children.length === 0) {return;}
                    js.pushWithSpace("else");
                    optF.static(table, js, method, isOther);
		},

		VariableStatement(_v, d, _s) {
                    var table = this.args.table;
                    var js = this.args.js;
                    var method = this.args.method;
                    var isOther = this.args.isOther;
                    d.static(table, js, method, isOther);
		},

		VariableDeclaration(n, i) {
                    var table = this.args.table;
                    var js = this.args.js;
                    var method = this.args.method;
                    var isOther = this.args.isOther;
                    js.push("env.");
                    js.push(n.sourceString);
                    js.pushWithSpace("= ");
                    if (i.children.length !== 0) {
			i.static(table, js, method, isOther);
                    } else {
			js.pushWithSpace("null;");
                    }
		},

		AssignmentStatement(l, _a, e, _) {
                    var table = this.args.table;
                    var js = this.args.js;
                    var method = this.args.method;
                    var isOther = this.args.isOther;
                    js.push("env.");
                    js.push(l.sourceString);
                    js.pushWithSpace("= ");
                    e.static(table, js, method, isOther);
		},

		Initialiser(_a, e) {
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		ExpressionStatement(e, _s) {
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		Expression(e) {
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		EqualityExpression(e) {
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		EqualityExpression_equal(l, _, r) {
                    staticTransBinOp(l, r, " == ", this.args);
		},

		EqualityExpression_notEqual(l, _, r) {
                    staticTransBinOp(l, r, " != ", this.args);
		},

		RelationalExpression(e) {
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		RelationalExpression_lt(l, _, r) {
                    staticTransBinOp(l, r, " < ", this.args);
		},

		RelationalExpression_gt(l, _, r) {
                    staticTransBinOp(l, r, " > ", this.args);
		},

		RelationalExpression_le(l, _, r) {
                    staticTransBinOp(l, r, " <= ", this.args);
		},

		RelationalExpression_ge(l, _, r) {
                    staticTransBinOp(l, r, " >= ", this.args);
		},

		LogicalExpression(e) {
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		LogicalExpression_and(l, _, r) {
                    staticTransBinOp(l, r, " && ", this.args);
		},

		LogicalExpression_or(l, _, r) {
                    staticTransBinOp(l, r, " || ", this.args);
		},

		AddExpression(e) {
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		AddExpression_plus(l, _, r) {
                    staticTransBinOp(l, r, " + ", this.args);
		},

		AddExpression_minus(l, _, r) {
                    staticTransBinOp(l, r, " - ", this.args);
		},

		MulExpression(e) {
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		MulExpression_times(l, _, r) {
                    staticTransBinOp(l, r, " * ", this.args);
		},

		MulExpression_divide(l, _, r) {
                    staticTransBinOp(l, r, " / ", this.args);
		},

		MulExpression_mod(l, _, r) {
                    staticTransBinOp(l, r, " % ", this.args);
		},

		UnaryExpression(e) {
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		UnaryExpression_plus(_p, e) {
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		UnaryExpression_minus(_p, e) {
                    var js = this.args.js;
                    js.pushWithSpace("-");
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		UnaryExpression_not(_p, e) {
                    var js = this.args.js;
                    js.pushWithSpace("!");
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		PrimExpression(e) {
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		PrimExpression_paren(_o, e, _c) {
                    e.static(this.args.table, this.args.js, this.args.method, this.args.isOther);
		},

		PrimExpression_string(e) {
                    var js = this.args.js;
                    js.push(e.sourceString);
		},

		PrimExpression_number(e) {
                    var js = this.args.js;
                    js.push(e.sourceString);
		},

		PrimExpression_field(n, _p, f) {
                    var js = this.args.js;
                    n.static(this.args.table, js, this.args.method, this.args.isOther);
                    js.push(".");
                    js.push(f.sourceString);
		},

		PrimExpression_variable(n) {
                    var table = this.args.table;
                    var js = this.args.js;
                    var method = this.args.method;
                    var isOther = this.args.isOther;
                    js.push('env["' + n.sourceString + '"]');
		},

		PrimitiveCall(n, _o, as, _c) {
                    var table = this.args.table;
                    var js = this.args.js;
                    var prim = n.sourceString;
                    var math = ["random", // 0 arg
				"abs", "acos", "acosh", "asin", "asinh", "atan", "atanh",
				"cbrt", "ceil", "cos", "cosh", "exp", "expm1", "floor",
				"log", "log1p", "log10", "log2", "round", "sign", "sin",
				"sinh", "sqrt", "tan", "tanh", "trunc", // 1 arg
				"atan2", "max", "min", "pow" // 2 args
                               ];
                    if (math.indexOf(prim) >= 0) {
			var actuals = as.static_method_helper(table, null, null, false);
			var str = actuals.join(", ");
			js.push("Math.");
			js.push(prim);
			js.push("(");
			js.push(str);
			js.push(")");
                    }
		},

		MethodCall(r, _p, n, _o, as, _c) {
                    var table = this.args.table;
                    var js = this.args.js;
                    var method = n.sourceString;

                    var displayBuiltIns = ["clear", "playSound"];

                    var builtIns = ["draw", "setCount", "fillRandom", "fillSpace", "fillRandomDir", "fillRandomDir3", "fillImage", "diffuse"];
                    var myTable = table[n.sourceString];

                    if (r.sourceString === "Display" && displayBuiltIns.indexOf(method) >= 0) {
			var actuals = as.static_method_helper(table, null, method, false);
			var str = actuals.join(", ");
			js.push(`env["${r.sourceString}"].${method}(${str})`);
			return;
                    }

                    if (builtIns.indexOf(method) >= 0) {
			var actuals = as.static_method_helper(table, null, method, false);
			var str = actuals.join(", ");
			js.push(`env["${r.sourceString}"].${method}(${str})`);
			return;
                    }

                    var actuals = as.static_method_helper(table, null, method, false);
                    var formals;
                    if (myTable) {
			formals = myTable.param;
                    }

                    if (formals && (actuals.length !== formals.size())) {
			throw "number of arguments don't match.";
                    }
                    var params = new CodeStream();
                    var objectsString = new CodeStream();

                    params.addTab();
                    objectsString.addTab();
                    for (var i = 0; i < actuals.length; i++) {
			var actual = actuals[i];
			if (formals) {
                            var formal = formals.at(i);
                            var shortName = formal[2];
                            var isOther = myTable.usedAsOther(shortName);
			} else {
                            var shortName = "t" + i;
                            isOther = false;
			}

			if (isOther) {
                            objectsString.tab();
                            objectsString.push(`objects["${shortName}"] = ${actual};\n`);
			} else {
                            params.push(`params["${shortName}"] = ${actual};\n`);
			}
                    }

                    var callProgram = `
(function() {
    var data = scripts["${n.sourceString}"];
    var func = data[0];
    var ins = data[1][0]; // [[name, <fieldName>]]
    var formals = data[1][1];
    var outs = data[1][2]; //[[object, <fieldName>]]
    var objects = {};
    objects.this = env["${r.sourceString}"];
    ${objectsString.contents()}
    var params = {};
    ${params.contents()}
    func(objects, outs, ins, params);
})()`;
                js.push(callProgram);
            },
        });
    }

    class OrderedPair {
	constructor() {
            this.keys = [];
            this.entries = {};
	}

	add(k, entry) {
            var maybeEntry = this.entries[k];
            if (maybeEntry) {
                if (maybeEntry[0] === entry[0] &&
                    maybeEntry[1] === entry[1] &&
                    maybeEntry[2] === entry[2]) {
                    return;
                } else {
                    throw "error duplicate variable" + k
                    return;
                }
            }
            this.entries[k] = entry;
            this.keys.push(k);
	}

	addAll(other) {
            other.keysAndValuesDo((key, entry) =>
				  this.add(key, entry));
	}

	at(key) {
            if (typeof key === "number") {
		return this.entries[this.keys[key]];
            } else {
		return this.entries[key];
            }
	}

	keysAndValuesDo(func) {
            for (var i = 0; i < this.keys.length; i++) {
		func(this.keys[i], this.entries[this.keys[i]]);
            }
	}

	keysAndValuesCollect(func) {
            var result = [];
            this.keysAndValuesDo((key, value) => {
		var element = func(key, value);
		result.push(element);
            });
            return result;
	}

	size() {
            return this.keys.length;
	}
    }

    class SymTable {
	constructor(entries) {
            this.forBreed = true;
            this.hasBreedInput = false;
            this.hasPatchInput = false;
            this.defaultUniforms = null;
            this.defaultAttributes = null;
            this.usedPrimitives = {};

            // - from source (extensional)
            // I use this term because I want to remember which is which)

            this.thisIn = new OrderedPair();   // v = this.x    -> ["propIn", "this", "x"]
            this.otherIn = new OrderedPair();  // v = other.x   -> ["propIn", "other", "x"]
            this.thisOut = new OrderedPair();  // this.x = ... -> ["propOut", "this", "x"]
            this.otherOut = new OrderedPair(); // other.x = ... -> ["propOut", "other", "x"]
            this.param = new OrderedPair();   // def foo(a, b, c) -> [["param", null, "a"], ...]
            this.local= new OrderedPair();    // var x = ... -> ["var", null, "x"]

            // - generated (intensional)

            this.varyingTable = new OrderedPair();
            this.uniformTable = new OrderedPair();
            this.scalarParamTable = new OrderedPair();

            if (entries) {
		for (var i = 0; i < entries.length; i++) {
                    this.add.apply(this, (entries[i]))
		}
            }

            this.defaultUniforms = ["u_resolution", "u_particleLength"];
            this.defaultAttributes = ["a_index"];
	}

	process() {
            // maybe a hack: look for outs that are not ins and add them to ins.  Those are use
            this.thisOut.keysAndValuesDo((key, entry) => {
		var newEntry = ["propIn", "this", entry[2]];
		var newK = newEntry.join(".");
		this.thisIn.add(newK, newEntry);
            });
            this.otherOut.keysAndValuesDo((key, entry) => {
		var newEntry = ["propIn", entry[1], entry[2]];
		var newK = newEntry.join(".");
		this.otherIn.add(newK, newEntry);
            });

            this.uniformTable.addAll(this.thisIn);
            this.uniformTable.addAll(this.otherIn);

            if (this.thisIn.size() > 0) {
		this.hasBreedInput = true;
            }
            if (this.otherIn.size() > 0) {
		this.hasPatchInput = true;
            }

            if (this.thisOut.size() > 0 && this.otherOut.size() > 0) {
		throw "shadama cannot write into this and others from the same script."
            } else {
		this.forBreed = this.thisOut.size() > 0;
            }

            if (this.forBreed) {
		this.varyingTable.addAll(this.thisOut);
            } else {
		this.varyingTable.addAll(this.otherOut);
            }
            this.param.keysAndValuesDo((key, entry) => {
		if (!this.usedAsOther(entry[2])) {
                    this.scalarParamTable.add(key, entry);
		}
            });
	};

	add(tag, rcvr, name) {
            var entry = [tag, rcvr, name];
            var k = [tag, rcvr ? rcvr : "null", name].join(".");

            if (tag === "propOut" && rcvr === "this") {
		this.thisOut.add(k, entry);
            } else if (tag === "propOut" && rcvr !== "this") {
		this.otherOut.add(k, entry);
            } else if (tag === "propIn" && rcvr === "this") {
		this.thisIn.add(k, entry);
            } else if (tag === "propIn" && rcvr !== "this") {
		this.otherIn.add(k, entry);
            } else if (tag === "param") {
		this.param.add(k, entry);
            } else if (tag === "var") {
		this.local.add(k, entry);
            }

            if ((this.otherOut.size() > 0 || this.otherIn.size() > 0) &&
		this.defaultUniforms.indexOf("u_that_x") < 0) {
		this.defaultUniforms = this.defaultUniforms.concat(["u_that_x", "u_that_y"]);
            }
	}

	usedAsOther(n) {
            var result = false;
            this.otherIn.keysAndValuesDo((k, entry) => {
		result = result || (entry[1] === n);
            });
            this.otherOut.keysAndValuesDo((k, entry) => {
		result = result || (entry[1] === n);
            });
            return result;
	}

	uniform(entry) {
            var k = ["propIn", entry[1], entry[2]].join(".");
            var entry = this.uniformTable.at(k);
            if (!entry) {
		debugger;
            }
            return ["u", entry[1], entry[2]].join("_");
	}

	varying(entry) {
            var k = ["propOut", entry[1], entry[2]].join(".");
            var entry = this.varyingTable.at(k);
            return ["v", entry[1],  entry[2]].join("_");
	}

	out(entry) {
            var k = ["propOut", entry[1], entry[2]].join(".");
            var entry = this.varyingTable.at(k);
            return ["o", entry[1],  entry[2]].join("_");
	}

	uniforms() {
            return this.uniformTable.keysAndValuesCollect((key, entry) =>
							  "uniform sampler2D " + this.uniform(entry) + ";");
	}

	paramUniforms() {
            var result = [];
            this.scalarParamTable.keysAndValuesDo((key, entry) => {
		result.push("uniform bool u_use_vector_" + entry[2] + ";");
		result.push("uniform sampler2D u_vector_" + entry[2] + ";");
		result.push("uniform float u_scalar_" + entry[2] + ";");
            });
            return result;
	}

	vertVaryings() {
            return this.varyingTable.keysAndValuesCollect((key, entry) =>
							  "out float " + this.varying(entry) + ";");
	}

	fragVaryings() {
            return this.varyingTable.keysAndValuesCollect((key, entry) =>
							  "in float " + this.varying(entry) + ";");
	}

	uniformDefaults() {
            return this.varyingTable.keysAndValuesCollect((key, entry) => {
		var u_entry = ["propIn", entry[1], entry[2]];
		var ind = entry[1] === "this" ? "ivec2(a_index)" : "ivec2(_pos)";
		return `${this.varying(entry)} = texelFetch(${this.uniform(u_entry)}, ${ind}, 0).r;`;
            })
	}

	outs() {
            var i = 0;
            var result = [];
            this.varyingTable.keysAndValuesDo((key, entry) => {
		result.push("layout (location = " + i + ") out float " + this.out(entry) + ";");
		i++;
            })
            return result;
	}

	fragColors() {
            return this.varyingTable.keysAndValuesCollect((key, entry) =>
							  this.out(entry) + " = " + this.varying(entry) + ";");
	}

	isBuiltin(n) {
            return this.defaultAttributes.indexOf(n) >= 0 || this.defaultUniforms.indexOf(n) >= 0 ;
	}

	insAndParamsAndOuts() {
            var ins = this.uniformTable.keysAndValuesCollect((key, entry) => [entry[1], entry[2]]);
            var shortParams = this.scalarParamTable.keysAndValuesCollect((key, entry) => entry[2]);
            var outs;
            if (this.forBreed) {
		outs = this.thisOut.keysAndValuesCollect((key, entry) => [entry[1], entry[2]]);
            } else {
		outs = this.otherOut.keysAndValuesCollect((key, entry) => [entry[1], entry[2]]);
            }
            return [ins, shortParams, outs];
	}

	rawTable() {
            var result = {};
            this.thisIn.keysAndValuesDo((key, entry) => result[key] = entry);
            this.thisOut.keysAndValuesDo((key, entry) => result[key] = entry);
            this.otherIn.keysAndValuesDo((key, entry) => result[key] = entry);
            this.otherOut.keysAndValuesDo((key, entry) => result[key] = entry);
            this.param.keysAndValuesDo((key, entry) => result[key] = entry);
            this.local.keysAndValuesDo((key, entry) => result[key] = entry);
            return result;
	}

	maybePrimitive(aString) {
            this.usedPrimitives[aString] = aString;
	}

	primitives() {
            var result = [];
            for (var n in this.usedPrimitives) {
		if (n === "random") {
                    result.push(
`
highp float random(float seed) {
   highp float a  = 12.9898;
   highp float b  = 78.233;
   highp float c  = 43758.5453;
   highp float dt = seed * a + b;
   highp float sn = mod(dt, 3.14159);
   return fract(sin(sn) * c);
}
`);
		}
            };
            return result;
	}
    }

    class CodeStream {
	constructor() {
            this.result = [];
            this.hadCR = true;
            this.hadSpace = true;
            this.tabLevel = 0;
	}

	addTab() {
            this.tabLevel++;
	}

	decTab() {
            this.tabLevel--;
	}

	cr() {
            this.result.push("\n");
            this.hadCR = true;
	}

	tab() {
            for (var i = 0; i < this.tabLevel; i++) {
		this.result.push("  ");
		this.hadSpace = true;
            }
	}

	skipSpace() {
            this.hadSpace = true;
	}

	crIfNeeded() {
            if (!this.hadCR) {
		this.cr();
            }
	}

	push(val) {
            this.result.push(val);
            var last = val[val.length - 1];
            this.hadSpace = (last === " " || last == "\n" || last == "{" || last == "(");
            this.hadCR = last == "\n";
	}

	pushWithSpace(val) {
            if (!this.hadSpace) {
		this.push(" ");
            }
            this.push(val);
	}

	contents() {
            function flatten(ary) {
		return ary.reduce(function (a, b) {
                    return a.concat(Array.isArray(b) ? flatten(b) : b)}, []).join("");
            };
            return flatten(this.result);
	}
    }

    function parse(aString, optRule) {
	var rule = optRule;
	if (!rule) {
            rule = "TopLevel";
	}
	return g.match(aString, rule);
    }

    function addAsSet(to, from) {
	for (var k in from) {
            if (from.hasOwnProperty(k)) {
		to[k] = from[k];
            }
	}
	return to;
    }

    function translate(str, prod, errorCallback) {
	if (!prod) {
            prod = "TopLevel";
	}
	var match = g.match(str, prod);
	if (!match.succeeded()) {
            console.log(str);
            console.log("did not parse: " + str);
            if (errorCallback) {
		return errorCallback(match, str);
            }
            return null;
	}

	var n = s(match);
	var symTable = n.symTable(null);
	return n.glsl(symTable, null, null);
    }

    Shadama.prototype.testCode3D = function() {
	return `
program "Fall"

breed Turtle (x, y, z, dx, dy, dz, r, g, b, a)

def setColor() {
  this.r = this.x / 512.0;
  this.g = this.y / 512.0;
  this.b = this.z / 512.0;
  this.a = 1.0;
}

def move() {
  var dx = this.dx;
  var dy = this.dy - 0.01;
  var dz = this.dz;

  var x = this.x + dx;
  var y = this.y + dy;
  var z = this.z + dz;  

  if (x < 0.0) {
     x = - x;
     dx = -dx;
  }

  if (x >= 512) {
     x = 512 - (x - 512);
     dx = - dx;
  }
  if (y < 0.0) {
     y = 512 - y;
     dy = -0.1;
  }
  if (y >= 512) {
     y = 512 - (y - 512);
     dy = -dy;
  }
  if (z < 0.0) {
     z = -z;
     dz = -dz;
  }
  if (z >= 512) {
     z = 512 - (z - 512);
     dz = -dz;
  }
  this.x = x;
  this.y = y;
  this.z = z;
  this.dx = dx;
  this.dy = dy;
  this.dz = dz;
}

static setup() {
  Turtle.setCount(600000);
  Turtle.fillRandom("x", 0, 512);
  Turtle.fillRandom("y", 0, 512);
  Turtle.fillRandom("z", 0, 512);
  Turtle.fillRandomDir3("dx", "dy", "dz");
  Turtle.setColor();
}

static loop(env) {
  Turtle.move();
}
`;
    }

    Shadama.prototype.testCode2D = function() {
	return `
program "Bounce"

breed Turtle (x, y, dx, dy, r, g, b, a)
breed Filler (x, y)
patch Field (nx, ny, r, g, b, a)

def setColor() {
  this.r = this.x / 512.0;
  this.g = this.y / 512.0;
  this.b = 0.0;
  this.a = 1.0;
}

def clear(field) {
  field.r = 0.0;
  field.g = 0.0;
  field.b = 0.0;
  field.a = 0.0;
  field.nx = 0.0;
  field.ny = 0.0;
}

def fillCircle(cx, cy, r, field) {
  var dx = this.x - cx;
  var dy = this.y - cy;
  var dr = sqrt(dx * dx + dy * dy);
  if (dr < r) {
    field.r = 0.2;
    field.g = 0.2;
    field.b = 0.8;
    field.a = 1.0;
    field.nx = dx / r;
    field.ny = dy / r;
  }
}

def zeroDir() {
  this.dx = 0.0;
  this.dy = 0.0;
}

def bounce(field) {
  var nx = field.nx;
  var ny = field.ny;
  var dx = this.dx;
  var dy = this.dy - 0.01;
  var dot = dx * nx + dy * ny;
  var rx = dx;
  var ry = dy;
  var origV = sqrt(dx * dx + dy * dy);

  if (dot < 0.0) {
    rx = dx - 2.0 * dot * nx;
    ry = dy - 2.0 * dot * ny;
    var norm = sqrt(rx * rx + ry * ry);
    rx = rx / (norm / origV);
    ry = ry / (norm / origV);
  }

  var newX = this.x + dx;
  var newY = this.y + dy;

  if (newX < 0.0) {
    newX = -newX;
    rx = -rx * 0.9;
  }
  if (newX > u_resolution.x) {
    newX = u_resolution.x - (newX - u_resolution.x);
    rx = -rx * 0.9;
  }
  if (newY < 0.0) {
    newY = mod(newY, u_resolution.y);
    ry = -0.1;
  }
  if (newY > u_resolution.y) {
    newY = u_resolution.y - (newY - u_resolution.y);
    ry = -ry;
  }

  this.x = newX;
  this.y = newY;
  this.dx = rx;
  this.dy = ry;
}

static setup() {
  Filler.fillSpace("x", "y", 512, 512);
  Turtle.setCount(300000);
  Turtle.fillRandom("x", 0, 512);
  Turtle.fillRandom("y", 256, 512);
  Turtle.fillRandomDir("dx", "dy");
  Turtle.setColor();
}

static loop(env) {
  Filler.clear(Field);
  Filler.fillCircle(75, 75, 20, Field);
  Filler.fillCircle(300, 95, 25, Field);
  Turtle.bounce(Field);
  Display.clear();
  Field.draw();
  Turtle.draw();
}
`;
    }

    if (!threeRenderer) {
	throw "needs a Three JS renderer";
	return;
    }
    renderer = threeRenderer;

    if (!renderer.context ||
	renderer.context.constructor != WebGL2RenderingContext) {
	throw "needs a WebGL2 context";
	return;
    }
    gl = renderer.context;

    if (!renderer.state) {
	throw "a WebGLState has to be passed in";
    }
    state = renderer.state;

    var ext = gl.getExtension("EXT_color_buffer_float");

    initBreedVAO();
    initPatchVAO();
    initCompiler();

    programs["drawBreed"] = drawBreedProgram();
    programs["drawPatch"] = drawPatchProgram();
    programs["debugPatch"] = debugPatchProgram();
    programs["debugPatch2"] = debugPatch2Program();
    programs["diffusePatch"] = diffusePatchProgram();
    programs["copy"] = copyProgram();
    programs["renderBreed"] = renderBreedProgram();



    return new Shadama();
}

//var shadama = {
//  loadShadama,
//  runner,
//  step,
//  testCode2D,
//  testCode3D,
//  initialize,
//  setTarget,
//  readPixels,
//  setReadPixelCallback,
//  pause,
//  destroy,
//  maybeRunner,
//  pointerdown,
//  pointermove,
//  pointerup,
//  debugDisplay,
//  makeOnAfterRender,
//  addEnv,
//};
