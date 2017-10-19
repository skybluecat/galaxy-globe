//copied from various modules
var table=[
	[0.0014,0.0000,0.0065], [0.0022,0.0001,0.0105], [0.0042,0.0001,0.0201],
	[0.0076,0.0002,0.0362], [0.0143,0.0004,0.0679], [0.0232,0.0006,0.1102],
	[0.0435,0.0012,0.2074], [0.0776,0.0022,0.3713], [0.1344,0.0040,0.6456],
	[0.2148,0.0073,1.0391], [0.2839,0.0116,1.3856], [0.3285,0.0168,1.6230],
	[0.3483,0.0230,1.7471], [0.3481,0.0298,1.7826], [0.3362,0.0380,1.7721],
	[0.3187,0.0480,1.7441], [0.2908,0.0600,1.6692], [0.2511,0.0739,1.5281],
	[0.1954,0.0910,1.2876], [0.1421,0.1126,1.0419], [0.0956,0.1390,0.8130],
	[0.0580,0.1693,0.6162], [0.0320,0.2080,0.4652], [0.0147,0.2586,0.3533],
	[0.0049,0.3230,0.2720], [0.0024,0.4073,0.2123], [0.0093,0.5030,0.1582],
	[0.0291,0.6082,0.1117], [0.0633,0.7100,0.0782], [0.1096,0.7932,0.0573],
	[0.1655,0.8620,0.0422], [0.2257,0.9149,0.0298], [0.2904,0.9540,0.0203],
	[0.3597,0.9803,0.0134], [0.4334,0.9950,0.0087], [0.5121,1.0000,0.0057],
	[0.5945,0.9950,0.0039], [0.6784,0.9786,0.0027], [0.7621,0.9520,0.0021],
	[0.8425,0.9154,0.0018], [0.9163,0.8700,0.0017], [0.9786,0.8163,0.0014],
	[1.0263,0.7570,0.0011], [1.0567,0.6949,0.0010], [1.0622,0.6310,0.0008],
	[1.0456,0.5668,0.0006], [1.0026,0.5030,0.0003], [0.9384,0.4412,0.0002],
	[0.8544,0.3810,0.0002], [0.7514,0.3210,0.0001], [0.6424,0.2650,0.0000],
	[0.5419,0.2170,0.0000], [0.4479,0.1750,0.0000], [0.3608,0.1382,0.0000],
	[0.2835,0.1070,0.0000], [0.2187,0.0816,0.0000], [0.1649,0.0610,0.0000],
	[0.1212,0.0446,0.0000], [0.0874,0.0320,0.0000], [0.0636,0.0232,0.0000],
	[0.0468,0.0170,0.0000], [0.0329,0.0119,0.0000], [0.0227,0.0082,0.0000],
	[0.0158,0.0057,0.0000], [0.0114,0.0041,0.0000], [0.0081,0.0029,0.0000],
	[0.0058,0.0021,0.0000], [0.0041,0.0015,0.0000], [0.0029,0.0010,0.0000],
	[0.0020,0.0007,0.0000], [0.0014,0.0005,0.0000], [0.0010,0.0004,0.0000],
	[0.0007,0.0002,0.0000], [0.0005,0.0002,0.0000], [0.0003,0.0001,0.0000],
	[0.0002,0.0001,0.0000], [0.0002,0.0001,0.0000], [0.0001,0.0000,0.0000],
	[0.0001,0.0000,0.0000], [0.0001,0.0000,0.0000], [0.0000,0.0000,0.0000]
];
function interpolateArrays(arrays, t) {
    if (t >= 1) {
        return arrays[arrays.length - 1];
    }
    if (arrays.length == 1) {
        return arrays[0];
    }
    var numStops = arrays.length - 1;
    var stopF = t * numStops;
    var stop = Math.floor(stopF);
    var k = stopF - stop;
    return lerp(arrays[stop], arrays[stop+1], k);
}
function lerpValues(value1, value2, t, out) {
    if (typeof value1 === 'number'
            && typeof value2 === 'number')
        return lerp(value1, value2, t)
    else { //assume array
        var len = Math.min(value1.length, value2.length)
        out = out||new Array(len)
        for (var i=0; i<len; i++) 
            out[i] = lerp(value1[i], value2[i], t)
        return out
    }
}
function lerp(v0, v1, t) {
    return v0*(1-t)+v1*t
}

var rgb={
	name: 'rgb',
	min: [0,0,0],
	max: [255,255,255],
	channel: ['red', 'green', 'blue'],
	alias: ['RGB']
};

rgb.hsv = function(rgb) {
	var r = rgb[0],
		g = rgb[1],
		b = rgb[2],
		min = Math.min(r, g, b),
		max = Math.max(r, g, b),
		delta = max - min,
		h, s, v;

	if (max === 0) {
		s = 0;
	}
	else {
		s = (delta/max * 100);
	}

	if (max === min) {
		h = 0;
	}
	else if (r === max) {
		h = (g - b) / delta;
	}
	else if (g === max) {
		h = 2 + (b - r) / delta;
	}
	else if (b === max) {
		h = 4 + (r - g) / delta;
	}

	h = Math.min(h * 60, 360);

	if (h < 0) {
		h += 360;
	}

	v = ((max / 255) * 1000) / 10;

	return [h, s, v];
};

rgb.hsl = function(rgb) {
	var r = rgb[0]/255,
			g = rgb[1]/255,
			b = rgb[2]/255,
			min = Math.min(r, g, b),
			max = Math.max(r, g, b),
			delta = max - min,
			h, s, l;

	if (max === min) {
		h = 0;
	}
	else if (r === max) {
		h = (g - b) / delta;
	}
	else if (g === max) {
		h = 2 + (b - r) / delta;
	}
	else if (b === max) {
		h = 4 + (r - g)/ delta;
	}

	h = Math.min(h * 60, 360);

	if (h < 0) {
		h += 360;
	}

	l = (min + max) / 2;

	if (max === min) {
		s = 0;
	}
	else if (l <= 0.5) {
		s = delta / (max + min);
	}
	else {
		s = delta / (2 - max - min);
	}

	return [h, s * 100, l * 100];
};

var xyz = {
	name: 'xyz',
	min: [0,0,0],
	channel: ['X','Y','Z'],
	alias: ['XYZ', 'ciexyz', 'cie1931']
};

rgb.xyz = function(rgb, white) {
	var r = rgb[0] / 255,
			g = rgb[1] / 255,
			b = rgb[2] / 255;

	// assume sRGB
	r = r > 0.04045 ? Math.pow(((r + 0.055) / 1.055), 2.4) : (r / 12.92);
	g = g > 0.04045 ? Math.pow(((g + 0.055) / 1.055), 2.4) : (g / 12.92);
	b = b > 0.04045 ? Math.pow(((b + 0.055) / 1.055), 2.4) : (b / 12.92);

	var x = (r * 0.41239079926595) + (g * 0.35758433938387) + (b * 0.18048078840183);
	var y = (r * 0.21263900587151) + (g * 0.71516867876775) + (b * 0.072192315360733);
	var z = (r * 0.019330818715591) + (g * 0.11919477979462) + (b * 0.95053215224966);

	white = white || xyz.whitepoint[2].E;

	return [x * white[0], y * white[1], z * white[2]];
};

var hsl={
	name: 'hsl',
	min: [0,0,0],
	max: [360,100,100],
	channel: ['hue', 'saturation', 'lightness'],
	alias: ['HSL'],

	rgb: function(hsl) {
		var h = hsl[0] / 360,
				s = hsl[1] / 100,
				l = hsl[2] / 100,
				t1, t2, t3, rgb, val;

		if (s === 0) {
			val = l * 255;
			return [val, val, val];
		}

		if (l < 0.5) {
			t2 = l * (1 + s);
		}
		else {
			t2 = l + s - l * s;
		}
		t1 = 2 * l - t2;

		rgb = [0, 0, 0];
		for (var i = 0; i < 3; i++) {
			t3 = h + 1 / 3 * - (i - 1);
			if (t3 < 0) {
				t3++;
			}
			else if (t3 > 1) {
				t3--;
			}

			if (6 * t3 < 1) {
				val = t1 + (t2 - t1) * 6 * t3;
			}
			else if (2 * t3 < 1) {
				val = t2;
			}
			else if (3 * t3 < 2) {
				val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
			}
			else {
				val = t1;
			}

			rgb[i] = val * 255;
		}

		return rgb;
	}
	,
	hsv:function(hsl) {
	var h = hsl[0],
			s = hsl[1] / 100,
			l = hsl[2] / 100,
			sv, v;
	l *= 2;
	s *= (l <= 1) ? l : 2 - l;
	v = (l + s) / 2;
	sv = (2 * s) / (l + s) || 0;

	return [h, sv * 100, v * 100];
	}
};

var hsv={
	name: 'hsv',
	min: [0,0,0],
	max: [360,100,100],
	channel: ['hue', 'saturation', 'value'],
	alias: ['HSV', 'HSB'],

	rgb: function(hsv) {
		var h = hsv[0] / 60,
			s = hsv[1] / 100,
			v = hsv[2] / 100,
			hi = Math.floor(h) % 6;

		var f = h - Math.floor(h),
			p = 255 * v * (1 - s),
			q = 255 * v * (1 - (s * f)),
			t = 255 * v * (1 - (s * (1 - f)));
		v *= 255;

		switch(hi) {
			case 0:
				return [v, t, p];
			case 1:
				return [q, v, p];
			case 2:
				return [p, v, t];
			case 3:
				return [p, q, v];
			case 4:
				return [t, p, v];
			case 5:
				return [v, p, q];
		}
	},

	hsl: function(hsv) {
		var h = hsv[0],
			s = hsv[1] / 100,
			v = hsv[2] / 100,
			sl, l;

		l = (2 - s) * v;
		sl = s * v;
		sl /= (l <= 1) ? l : 2 - l;
		sl = sl || 0;
		l /= 2;

		return [h, sl * 100, l * 100];
	}
};


/**
 * Whitepoint reference values with observer/illuminant
 *
 * http://en.wikipedia.org/wiki/Standard_illuminant
 */
xyz.whitepoint = {
	//1931 2°
	2: {
		//incadescent
		A:[109.85, 100, 35.585],
		// B:[],
		C: [98.074, 100, 118.232],
		D50: [96.422, 100, 82.521],
		D55: [95.682, 100, 92.149],
		//daylight
		D65: [95.045592705167, 100, 108.9057750759878],
		D75: [94.972, 100, 122.638],
		//flourescent
		// F1: [],
		F2: [99.187, 100, 67.395],
		// F3: [],
		// F4: [],
		// F5: [],
		// F6:[],
		F7: [95.044, 100, 108.755],
		// F8: [],
		// F9: [],
		// F10: [],
		F11: [100.966, 100, 64.370],
		// F12: [],
		E: [100,100,100]
	},

	//1964  10°
	10: {
		//incadescent
		A:[111.144, 100, 35.200],
		C: [97.285, 100, 116.145],
		D50: [96.720, 100, 81.427],
		D55: [95.799, 100, 90.926],
		//daylight
		D65: [94.811, 100, 107.304],
		D75: [94.416, 100, 120.641],
		//flourescent
		F2: [103.280, 100, 69.026],
		F7: [95.792, 100, 107.687],
		F11: [103.866, 100, 65.627],
		E: [100,100,100]
	}
};


/**
 * Top values are the whitepoint’s top values, default are D65
 */
xyz.max = xyz.whitepoint[2].D65;


/**
 * Transform xyz to rgb
 *
 * @param {Array} xyz Array of xyz values
 *
 * @return {Array} RGB values
 */
xyz.rgb = function (_xyz, white) {
	//FIXME: make sure we have to divide like this. Probably we have to replace matrix as well then
	white = white || xyz.whitepoint[2].E;

	var x = _xyz[0] / white[0],
		y = _xyz[1] / white[1],
		z = _xyz[2] / white[2],
		r, g, b;

	// assume sRGB
	// http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
	r = (x * 3.240969941904521) + (y * -1.537383177570093) + (z * -0.498610760293);
	g = (x * -0.96924363628087) + (y * 1.87596750150772) + (z * 0.041555057407175);
	b = (x * 0.055630079696993) + (y * -0.20397695888897) + (z * 1.056971514242878);

	r = r > 0.0031308 ? ((1.055 * Math.pow(r, 1.0 / 2.4)) - 0.055)
		: r = (r * 12.92);

	g = g > 0.0031308 ? ((1.055 * Math.pow(g, 1.0 / 2.4)) - 0.055)
		: g = (g * 12.92);

	b = b > 0.0031308 ? ((1.055 * Math.pow(b, 1.0 / 2.4)) - 0.055)
		: b = (b * 12.92);

	r = Math.min(Math.max(0, r), 1);
	g = Math.min(Math.max(0, g), 1);
	b = Math.min(Math.max(0, b), 1);

	return [r * 255, g * 255, b * 255];
}

	
	

function approx (wave) {
	return [x(wave), y(wave), z(wave)];
}

function x ( wave ) {
	let t1 = (wave-442.0)*((wave<442.0)?0.0624:0.0374);
	let t2 = (wave-599.8)*((wave<599.8)?0.0264:0.0323);
	let t3 = (wave-501.1)*((wave<501.1)?0.0490:0.0382);
	return 0.362*Math.exp(-0.5*t1*t1) + 1.056*Math.exp(-0.5*t2*t2)
- 0.065*Math.exp(-0.5*t3*t3);
}
function y ( wave ) {
	let t1 = (wave-568.8)*((wave<568.8)?0.0213:0.0247);
	let t2 = (wave-530.9)*((wave<530.9)?0.0613:0.0322);
	return 0.821*Math.exp(-0.5*t1*t1) + 0.286*Math.exp(-0.5*t2*t2);
}
function z ( wave ) {
	let t1 = (wave-437.0)*((wave<437.0)?0.0845:0.0278);
	let t2 = (wave-459.0)*((wave<459.0)?0.0385:0.0725);
	return 1.217*Math.exp(-0.5*t1*t1) + 0.681*Math.exp(-0.5*t2*t2);
}
approx.x = x;
approx.y = y;
approx.z = z;
function spectrumToColor (intensities, opts) {
	if (!opts) opts = {};

	opts.approximate = opts.approximate == null ? true : opts.approximate;
	opts.normalize = opts.normalize == null ? true : opts.normalize;
	opts.whitepoint = opts.whitepoint || xyz.whitepoint[2].D65;

	let values;
	if (typeof intensities === 'number') {
		values = wavelengthToXyz(intensities, opts);
	}
	else {
		values = spectrumToXyz(intensities, opts);
	}

	let rgb = xyz.rgb(values, opts.whitepoint).map(v => Math.floor(v));

	return `rgb(${rgb})`;
};
//convert any intensities array to rgb color
function spectrumToXyz (intensities, opts) {
	if (!intensities) return [0, 0, 0];

	if (typeof intensities === 'number') {
		return wavelengthToXyz(intensities, opts);
	}

	//append spectrum for interpolation
	if (intensities.length === 1) {
		return wavelengthToXyz(intensities[0], opts);
	}

	let normalize = opts.normalize;
	let approximate = opts.approximate;
	let whitepoint = opts.whitepoint;

	let lMin = 380;
	let lMax = 780;
	let fMin = 1/lMax;
	let fMax = 1/lMin;

	//get sum for normalization
	let sum = 0;
	if (normalize) {
		for (let i = 0; i < intensities.length; i++) {
			sum += intensities[i];
		}
	}

	//integrate over magnitudes
	let X = 0, Y = 0, Z = 0, XYZ;

	for (let i = .5; i < intensities.length; i++) {
		let mag = intensities[Math.floor(i)];

		if (normalize) mag = sum === 0 ? mag : mag/sum;

		if (!mag) {
			continue;
		}

		let nf = i / intensities.length;
		let f = nf * (fMax - fMin) + fMin;
		let l = 1/f;
		let nl = (l - lMin) / (lMax - lMin);

		//table-based method
		let xyz = approximate ? approx(l) : interpolate(table, nl);
		X += mag * xyz[0];
		Y += mag * xyz[1];
		Z += mag * xyz[2];
	}

	return [X, Y, Z].map((v, i) => v * whitepoint[i]);
}


function wavelengthToXyz (l, opts) {
	let whitepoint = opts.whitepoint;

	let xyz;
	if (opts.approximate) {
		xyz = approx(l);
	}
	else {
		let r = (l - 380) / 400;
		xyz = interpolate(table, r);
	}

	return xyz.map((v, i) => v * whitepoint[i]);
}