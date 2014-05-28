/*! naptha 22-04-2014 */
IMPORTED = true
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

// namespace ?
var jsfeat = jsfeat || { REVISION: 'ALPHA' };



/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

(function(global) {
    "use strict";
    //

    // CONSTANTS
    var EPSILON = 0.0000001192092896;
    var FLT_MIN = 1E-37;

    // implementation from CCV project
    // currently working only with u8,s32,f32
    var U8_t = 0x0100,
        S32_t = 0x0200,
        F32_t = 0x0400,
        S64_t = 0x0800,
        F64_t = 0x1000;

    var C1_t = 0x01,
        C2_t = 0x02,
        C3_t = 0x03,
        C4_t = 0x04;

    var _data_type_size = new Int32Array([ -1, 1, 4, -1, 4, -1, -1, -1, 8, -1, -1, -1, -1, -1, -1, -1, 8 ]);

    var get_data_type = (function () {
        return function(type) {
            return (type & 0xFF00);
        }
    })();

    var get_channel = (function () {
        return function(type) {
            return (type & 0xFF);
        }
    })();

    var get_data_type_size = (function () {
        return function(type) {
            return _data_type_size[(type & 0xFF00) >> 8];
        }
    })();

    // box blur option
    var BOX_BLUR_NOSCALE = 0x01;
    // svd options
    var SVD_U_T = 0x01;
    var SVD_V_T = 0x02;

    var data_t = (function () {
        function data_t(size_in_bytes, buffer) {
            // we need align size to multiple of 8
            this.size = ((size_in_bytes + 7) | 0) & -8;
            if (typeof buffer === "undefined") { 
                this.buffer = new ArrayBuffer(this.size);
            } else {
                this.buffer = buffer;
                this.size = buffer.length;
            }
            this.u8 = new Uint8Array(this.buffer);
            this.i32 = new Int32Array(this.buffer);
            this.f32 = new Float32Array(this.buffer);
            this.f64 = new Float64Array(this.buffer);
        }
        return data_t;
    })();

    var matrix_t = (function () {
        // columns, rows, data_type
        function matrix_t(c, r, data_type, data_buffer) {
            this.type = get_data_type(data_type)|0;
            this.channel = get_channel(data_type)|0;
            this.cols = c|0;
            this.rows = r|0;
            if (typeof data_buffer === "undefined") { 
                this.allocate();
            } else {
                this.buffer = data_buffer;
                // data user asked for
                this.data = this.type&U8_t ? this.buffer.u8 : (this.type&S32_t ? this.buffer.i32 : (this.type&F32_t ? this.buffer.f32 : this.buffer.f64));
            }
        }
        matrix_t.prototype.allocate = function() {
            // clear references
            delete this.data;
            delete this.buffer;
            //
            this.buffer = new data_t((this.cols * get_data_type_size(this.type) * this.channel) * this.rows);
            this.data = this.type&U8_t ? this.buffer.u8 : (this.type&S32_t ? this.buffer.i32 : (this.type&F32_t ? this.buffer.f32 : this.buffer.f64));
        }
        matrix_t.prototype.copy_to = function(other) {
            var od = other.data, td = this.data;
            var i = 0, n = (this.cols*this.rows*this.channel)|0;
            for(; i < n-4; i+=4) {
                od[i] = td[i];
                od[i+1] = td[i+1];
                od[i+2] = td[i+2];
                od[i+3] = td[i+3];
            }
            for(; i < n; ++i) {
                od[i] = td[i];
            }
        }
        matrix_t.prototype.resize = function(c, r, ch) {
            if (typeof ch === "undefined") { ch = this.channel; }
            // change buffer only if new size doesnt fit
            var new_size = (c * ch) * r;
            if(new_size > this.rows*this.cols*this.channel) {
                this.cols = c;
                this.rows = r;
                this.channel = ch;
                this.allocate();
            } else {
                this.cols = c;
                this.rows = r;
                this.channel = ch;
            }
        }

        return matrix_t;
    })();

    var pyramid_t = (function () {

        function pyramid_t(levels) {
            this.levels = levels|0;
            this.data = new Array(levels);
            this.pyrdown = jsfeat.imgproc.pyrdown;
        }

        pyramid_t.prototype.allocate = function(start_w, start_h, data_type) {
            var i = this.levels;
            while(--i >= 0) {
                this.data[i] = new matrix_t(start_w >> i, start_h >> i, data_type);
            }
        }

        pyramid_t.prototype.build = function(input, skip_first_level) {
            if (typeof skip_first_level === "undefined") { skip_first_level = true; }
            // just copy data to first level
            var i = 2, a = input, b = this.data[0];
            if(!skip_first_level) {
                var j=input.cols*input.rows;
                while(--j >= 0) {
                    b.data[j] = input.data[j];
                }
            }
            b = this.data[1];
            this.pyrdown(a, b);
            for(; i < this.levels; ++i) {
                a = b;
                b = this.data[i];
                this.pyrdown(a, b);
            }
        }

        return pyramid_t;
    })();

    var point2d_t = (function () {
        function point2d_t(x,y,score,level) {
            if (typeof x === "undefined") { x=0; }
            if (typeof y === "undefined") { y=0; }
            if (typeof score === "undefined") { score=0; }
            if (typeof level === "undefined") { level=0; }

            this.x = x;
            this.y = y;
            this.score = score;
            this.level = level;
        }
        return point2d_t;
    })();


    // data types
    global.U8_t = U8_t;
    global.S32_t = S32_t;
    global.F32_t = F32_t;
    global.S64_t = S64_t;
    global.F64_t = F64_t;
    // data channels
    global.C1_t = C1_t;
    global.C2_t = C2_t;
    global.C3_t = C3_t;
    global.C4_t = C4_t;

    // popular formats
    global.U8C1_t = U8_t | C1_t;
    global.U8C3_t = U8_t | C3_t;
    global.U8C4_t = U8_t | C4_t;

    global.F32C1_t = F32_t | C1_t;
    global.F32C2_t = F32_t | C2_t;
    global.S32C1_t = S32_t | C1_t;
    global.S32C2_t = S32_t | C2_t;

    // constants
    global.EPSILON = EPSILON;
    global.FLT_MIN = FLT_MIN;

    // options
    global.BOX_BLUR_NOSCALE = BOX_BLUR_NOSCALE;
    global.SVD_U_T = SVD_U_T;
    global.SVD_V_T = SVD_V_T;

    global.get_data_type = get_data_type;
    global.get_channel = get_channel;
    global.get_data_type_size = get_data_type_size;

    global.data_t = data_t;
    global.matrix_t = matrix_t;
    global.pyramid_t = pyramid_t;
    global.point2d_t = point2d_t;

})(jsfeat);


// https://github.com/harthur/color-convert
// https://github.com/THEjoezack/ColorMine/blob/master/ColorMine/ColorSpaces/Comparisons/Cie94Comparison.cs

function deltaE(labA, labB){
  var deltaL = labA[0] - labB[0];
  var deltaA = labA[1] - labB[1];
  var deltaB = labA[2] - labB[2];
  var c1 = Math.sqrt(labA[1] * labA[1] + labA[2] * labA[2]);
  var c2 = Math.sqrt(labB[1] * labB[1] + labB[2] * labB[2]);
  var deltaC = c1 - c2;

  var deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
  deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);

  var sc = 1.0 + 0.045 * c1;
  var sh = 1.0 + 0.015 * c1;

  var deltaLKlsl = deltaL / (1.0);
  var deltaCkcsc = deltaC / (sc);
  var deltaHkhsh = deltaH / (sh);
  var i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
  return i < 0 ? 0 : Math.sqrt(i);
}

function lab2rgb(lab){
  var y = (lab[0] + 16) / 116,
      x = lab[1] / 500 + y,
      z = y - lab[2] / 200,
      r, g, b;

  x = 0.95047 * ((x * x * x > 0.008856) ? x * x * x : (x - 16/116) / 7.787);
  y = 1.00000 * ((y * y * y > 0.008856) ? y * y * y : (y - 16/116) / 7.787);
  z = 1.08883 * ((z * z * z > 0.008856) ? z * z * z : (z - 16/116) / 7.787);

  r = x *  3.2406 + y * -1.5372 + z * -0.4986;
  g = x * -0.9689 + y *  1.8758 + z *  0.0415;
  b = x *  0.0557 + y * -0.2040 + z *  1.0570;

  r = (r > 0.0031308) ? (1.055 * Math.pow(r, 1/2.4) - 0.055) : 12.92 * r;
  g = (g > 0.0031308) ? (1.055 * Math.pow(g, 1/2.4) - 0.055) : 12.92 * g;
  b = (b > 0.0031308) ? (1.055 * Math.pow(b, 1/2.4) - 0.055) : 12.92 * b;

  return [Math.max(0, Math.min(1, r)) * 255, 
          Math.max(0, Math.min(1, g)) * 255, 
          Math.max(0, Math.min(1, b)) * 255]
}


function rgb2lab(rgb){
  var r = rgb[0] / 255,
      g = rgb[1] / 255,
      b = rgb[2] / 255,
      x, y, z;

  r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
  y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
  z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;

  return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)]
}


// var minl = Infinity, maxl = -Infinity;
// var mina = Infinity, maxa = -Infinity;
// var minb = Infinity, maxb = -Infinity;
// for(var r = 0; r < 256; r+=2){
//   for(var g = 0; g < 256; g+=2){
//     for(var b = 0; b < 256; b+=2){
//       var lab = rgb2lab([r,g,b])
//       minl = Math.min(minl, lab[0])
//       maxl = Math.max(maxl, lab[0])
//       mina = Math.min(mina, lab[1])
//       maxa = Math.max(maxa, lab[1])
//       minb = Math.min(minb, lab[2])
//       maxb = Math.max(maxb, lab[2])
//     }
//   }
// }


function get_letters(col){
	var letters = [];
	for(var i = 0; i < col.lines.length; i++){
		var line = col.lines[i]
		for(var j = 0; j < line.words.length; j++){
			var word = line.words[j];
			for(var k = 0; k < word.letters.length; k++){
				var letter = word.letters[k];
				letters.push(letter)
			}
		}
	}
	return letters;
}


function resize_contours(params){
	var marker = new jsfeat.matrix_t(params.sw, params.sh, jsfeat.U8C1_t);
	var r = (params.mskscale / params.swtscale) / 2;

	for(var k = 0; k < params.letters.length; k++){
		var letter = params.letters[k];
		var lw = (letter.x1 - letter.x0 + 1); // letter width because letter.width is defined wrong

		for(var n = 0; n < letter.shape.length; n++){
			var x = (((letter.shape[n] % lw) + letter.x0 - params.region.x0) / params.swtscale + params.xpad) * params.mskscale
			var y = ((Math.floor(letter.shape[n] / lw) + letter.y0 - params.region.y0) / params.swtscale + params.ypad) * params.mskscale

			for(var dx = -r; dx <= r; dx++){
				for(var dy = -r; dy <= r; dy++){
					// if(x + dx >= marker.cols || x - dx < 0) continue;
					// if(y + dy >= marker.rows || y - dy < 0) continue;
					marker.data[Math.floor(x + dx) + Math.floor(y + dy) * params.sw] = 1
				}
			}
		}
	}
	return marker;
}


function erode_contours(marker){
	var erosion = new jsfeat.matrix_t(marker.cols, marker.rows, jsfeat.U8C1_t);
	erosion.data.set(marker.data)

	for(var i = 0; i < marker.data.length; i++){
		if(!marker.data[i]){
			erosion.data[i + 1] = erosion.data[i - 1] = erosion.data[i + erosion.cols] = erosion.data[i - marker.cols] = 0
		}
	}
	return erosion
}



function dilate_contours(marker){
	var dilation = new jsfeat.matrix_t(marker.cols, marker.rows, jsfeat.U8C1_t);
	for(var i = 0; i < marker.data.length; i++){
		if(marker.data[i]){
			dilation.data[i + 1] = dilation.data[i - 1] = dilation.data[i + dilation.cols] = dilation.data[i - marker.cols] = 1
		}
	}
	return dilation
}


function reconstruct(filtered, marker, letters){
	var recon = new jsfeat.matrix_t(filtered.cols, filtered.rows, jsfeat.U8C1_t)

	var dx8 = [-1, 1, -1, 0, 1, -1, 0, 1];
	var dy8 = [0, 0, -1, -1, -1, 1, 1, 1];

	var queued = new jsfeat.matrix_t(filtered.cols, filtered.rows, jsfeat.U8C1_t)
	
	var contours = [];

	for(var i = 0; i < filtered.cols * filtered.rows; i++){
		if(queued.data[i] || !filtered.data[i]) continue;

		var ix = i % filtered.cols, iy = Math.floor(i / filtered.cols)
		
		queued.data[i] = 1
		var is_glyph = false;
		var contour = []
		var stack = [i]
		var closed;
		

		while(closed = stack.shift()){
			contour.push(closed)
			var cx = closed % filtered.cols, cy = Math.floor(closed / filtered.cols);
			var w = filtered.data[closed];
			for(var k = 0; k < 8; k++){
				var nx = cx + dx8[k]
				var ny = cy + dy8[k]
				var n = ny * filtered.cols + nx;

				if(nx >= 0 && nx < filtered.cols &&
				   ny >= 0 && ny < filtered.rows &&
				   filtered.data[n] &&
				   !queued.data[n]){
				   	if(!is_glyph && marker.data[n]){
				   		is_glyph = true;
				   	}
					queued.data[n] = 1
					// update the average stroke width
					stack.push(n)
				}
			}
		}

		if(contour.length < 2) continue;

		contours.push([is_glyph, contour])
		
	}
	// postMessage({log: contours})
	var sorted = contours.filter(function(e){ return e[0] == true })
				.map(function(e){ return e[1].length })
				.sort(function(a, b){ return a - b});

	for(var k = 0; k < contours.length; k++){
		var is_glyph = contours[k][0],
			contour = contours[k][1];

		var accept = false;
		if(is_glyph){
			accept = true;

		}else{
			var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;

			// postMessage({log: 'cont'+contour.length})
			for(var i = 0; i < contour.length; i++){
				var x = contour[i] % filtered.cols,
					y = Math.floor(contour[i] / filtered.cols);
				x0 = Math.min(x0, x); y0 = Math.min(y0, y);
				x1 = Math.max(x1, x); y1 = Math.max(y1, y);
			}
			var sw = x1 - x0, sh = y1 - y0;
			var ratio = Math.max(sw, sh) / Math.min(sw, sh);

			// specks can not intersect with letters
			// var intersects = letters.some(function(a){
			// 	var sw = Math.min((a.x1 - box.x0) * s, x1) - Math.max((a.x0 - box.x0) * s, x0),
			// 		sh = Math.min((a.y1 - box.y0) * s, y1) - Math.max((a.y0 - box.y0) * s, y0)
			// 	return sw > -5 && sh > -5
			// })

			// console.log(sh, sw, y1, y0, contour)
			var touches_edge = x0 == 0 || x1 == filtered.cols - 1 || y0 == 0 || y1 == filtered.rows - 1;

			if(contour.length > sorted[0] / 10 && 
				contour.length < sorted[sorted.length - 1] * 2 && 
			   sw / sh < 20 &&
			   sh / sw < 20 &&
			   !touches_edge){
				accept = true
			}
		}

		if(accept){
			for(var j = 0; j < contour.length; j++){
				recon.data[contour[j]] = 1
			}
		}
	}
	return recon
}

function region_filter(mask, src){
	// what is the radius of the structuring element for our morphological dilation
	var dilrad = 7;

	
	var width = src.width,
		height = src.height;

	// perhaps we should use a circular structuring element
	// instead of a box because that means less pixel fills
	// which might be faster, because maybe we should pre
	// cache all thse offsets anyway



	var marker = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
	var dilation = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
	

	console.time('morphological dilation')


	// for(var i = 0; i < mask.data.length; i++){
	// 	if(!mask.data[i]) continue;

	// 	for(var dx = -dilrad; dx <= dilrad; dx++){
	// 		for(var dy = -dilrad; dy <= dilrad; dy++){
	// 			dilation.data[i + dx + dy * width] = 1
	// 		}
	// 	}
	// }
	var grown = dilate_contours(dilate_contours(erode_contours(mask)))

	var dilation = grown;
	for(var i = 0; i < dilrad; i++){
		dilation = dilate_contours(dilation)
	}
	// for(var i = dilrad; i < width - dilrad; i++){
	// 	for(var j = dilrad; j < height - dilrad; j++){
	// 		if(!grown.data[i + j * width]) continue;

	// 		for(var dx = -dilrad; dx <= dilrad; dx++){
	// 			for(var dy = -dilrad; dy <= dilrad; dy++){
	// 				dilation.data[i + dx + (dy + j) * width] = 1
	// 			}
	// 		}
	// 	}
	// }

	for(var i = 0; i < mask.data.length; i++){
		// if(grown.data[i])
		// 	dilation.data[i] = 3;

		if(!grown.data[i]) continue;
		dilation.data[i] = 2;
	}

	// visualize_matrix(dilation)


	console.timeEnd('morphological dilation')

	
	var pixmap = new Uint16Array(width * height)
	var intoct = new Uint32Array(16 * 16 * 16)
	var extoct = new Uint32Array(16 * 16 * 16)
	// var zeroes = new Uint32Array(16 * 16 * 16)

	var labtab = {};

	console.time("color filter")
	

	for(var y = 0; y < height; y++){
		for(var x = 0; x < width; x++){
			var p = x + y * width;

			var rgb_color = Math.floor(src.data[4 * p] / 8) + 
							Math.floor(src.data[4 * p + 1] / 8) * 32 + 
							Math.floor(src.data[4 * p + 2] / 8) * 1024;
			// here we round the color kinda to speed up rgb->lab conversion
			// because the conversion is kinda slow

			if(!(rgb_color in labtab)){

				var lab = rgb2lab([src.data[4 * p], src.data[4 * p + 1], src.data[4 * p + 2]])
				// var color =     Math.floor((2 * lab[0] + 30) / 16) + 
				// 				Math.floor((lab[1] + 130) / 16) * 16 + 
				// 				Math.floor((lab[2] + 130) / 16) * 256
				var color = Math.round((lab[0] + 40) / 16) |
							Math.round((lab[1] + 128) / 16) << 4 |
							Math.round((lab[2] + 128) / 16) << 8;

				labtab[rgb_color] = color					
			}else{
				var color = labtab[rgb_color]
			}

			pixmap[p] = color
			if(dilation.data[p] === 1){
				extoct[color]++
				extoct[color+16]++
				extoct[color-16]++
				extoct[color+256]++
				extoct[color-256]++
				extoct[color+1]++
				extoct[color-1]++
			}else if(dilation.data[p] === 2){
				intoct[color]++
				intoct[color+16]++
				intoct[color-16]++
				intoct[color+256]++
				intoct[color-256]++
				intoct[color+1]++
				intoct[color-1]++
			}
		}
	}

	// var invmap = {}
	// for(var i in labtab){
	// 	invmap[labtab[i]] = [(i % 32) * 8, (Math.floor(i / 32) % 32) * 8, (Math.floor(i / 1024)) * 8 ]
	// }
	// var merp = document.createElement('canvas')
	// merp.width = 256
	// merp.height = 256
	// document.body.appendChild(merp)
	// console.log(merp)
	// merp = merp.getContext('2d')
	// merp.beginPath()
	// merp.strokeStyle = '#e0e0e0'
	// for(var i = 0; i < 256 * 2; i+=5){
	// 	merp.moveTo(0, i)
	// 	merp.lineTo(i, 0)
	// }
	// merp.stroke()
	// var sum = 0, count = 0;
	// for(var color = 0; color < intoct.length; color++){
	// 	var frac = intoct[color] / (1 + extoct[color]);
	// 	if(frac > 1){
	// 		sum += frac
	// 		count++
	// 	}
	// }
	// var dev = 0, mean = sum / count;
	// for(var color = 0; color < intoct.length; color++){
	// 	var frac = intoct[color] / (1 + extoct[color]);
	// 	if(frac > 1){
	// 		// sum += frac
	// 		dev += (frac - mean) * (frac - mean)
	// 	}
	// }
	// postMessage({log: 'stdev' + Math.sqrt(dev / count)})

	// postMessage({log: 'thresh indicator'+(high_match / low_match)})
	
	// var ratmap = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
	
	// for(var p = 0; p < width * height; p++){
	// 	var color = pixmap[p]
	// 	var level = Math.min(255, intoct[color] / (1 + extoct[color]))
	// 	ratmap.data[p] = level
	// }

	// postMessage({visualize: ratmap})

	var buckets = [], itotes = 0, max_level = 8;

	for(var i = 0; i < max_level + 1; i++) buckets[i] = 0;


	for(var p = 0; p < width * height; p++){
		var color = pixmap[p]
		var level = Math.min(max_level, intoct[color] / (1 + extoct[color]))
		if(level > 1){
			buckets[Math.floor(level)]++	
			itotes++
		}
	}

	var median = 1;
	var cumsum = 0;

	// postMessage({'log': buckets})
	for(var i = 0; i < max_level + 1; i++){
		cumsum += buckets[i]
		if(cumsum > itotes / 2){
			// postMessage({'log': 'median value' + i})
			// median = Math.max(1, i - 4)
			if(i == max_level) median = 4;
			break
		}
	}


	for(var y = 0; y < height; y++){
		for(var x = 0; x < width; x++){
			var p = x + y * width;
			var color = pixmap[p]
			if(intoct[color] / (1 + extoct[color]) > median){
			// if(intoct[color] > extoct[color]){
				// marker.data[p] = Math.min(255, 2 * (intoct[color] / (1 + extoct[color])))
				marker.data[p] = 1
			}

			// var l = (color % 16) * 16, 
			// 	a = (Math.floor(color / 16) % 16) * 16, 
			// 	b = (Math.floor(color / 256)) * 16;
			// if(intoct[color] / (1 + extoct[color]) > 1){
			// 	merp.fillStyle = 'rgb(' + invmap[color].join(',') + ')'
			// 	merp.fillRect(l, b, 16, 16)
			// }else{

			// 	merp.strokeStyle = 'rgb(' + invmap[color].join(',') + ')'
			// 	merp.lineWidth = 3
			// 	merp.strokeRect(l + merp.lineWidth, b + merp.lineWidth, 16 - 2 * merp.lineWidth, 16 - 2 * merp.lineWidth)
			// }
		}
	}

	
	// if(median > 2){
	// 	var dilation = dilate_contours(marker)
	// 	for(var i = 0; i < dilation.data.length; i++){
	// 		if(dilation.data[i]){
	// 			var color = pixmap[i]
	// 			if(intoct[color] / (1 + extoct[color]) > 1){
	// 				marker.data[i] = 1
	// 			}
	// 		}
	// 	}	
	// }
	


	console.timeEnd('color filter')

	// console.image(merp.canvas.toDataURL('image/png'))

	// visualize_matrix(marker)

	return {
		mask: marker
	}
}

/*
  This implementation is very loosely based off js-priority-queue
  by Adam Hooper from https://github.com/adamhooper/js-priority-queue
  
  The js-priority-queue implementation seemed a teensy bit bloated
  with its require.js dependency and multiple storage strategies
  when all but one were strongly discouraged. So here is a kind of 
  condensed version of the functionality with only the features that
  I particularly needed. 

  Using it is pretty simple, you just create an instance of HeapQueue
  while optionally specifying a comparator as the argument:

  var heapq = new HeapQueue()

  var customq = new HeapQueue(function(a, b){
  	// if b > a, return negative
  	// means that it spits out the smallest item first
	return a - b
  })

  Note that in this case, the default comparator is identical to
  the comparator which is used explicitly in the second queue.

  Once you've initialized the heapqueue, you can plop some new
  elements into the queue with the push method (vaguely reminiscent
  of typical javascript arays)

  heapq.push(42);
  heapq.push("kitten");

  The push method returns the new number of elements of the queue.

  You can push anything you'd like onto the queue, so long as your
  comparator function is capable of handling it. The default 
  comparator is really stupid so it won't be able to handle anything
  other than an number by default.

  You can preview the smallest item by using peek.

  heapq.push(-9999)
  heapq.peek() ==> -9999

  The useful complement to to the push method is the pop method, 
  which returns the smallest item and then removes it from the
  queue.

  heapq.push(1)
  heapq.push(2)
  heapq.push(3)
  heapq.pop() ==> 1
  heapq.pop() ==> 2
  heapq.pop() ==> 3

*/
function HeapQueue(cmp){
	this.cmp = (cmp || function(a, b){ return a - b });
	this.length = 0;
	this.data = []
}
HeapQueue.prototype.peek = function(){
	return this.data[0]
}
HeapQueue.prototype.push = function(value){
	this.data.push(value);
	var pos = this.data.length - 1,
		parent, x;
	while(pos > 0){
		parent = (pos - 1) >>> 1;
		if(this.cmp(this.data[pos], this.data[parent]) < 0){
			x = this.data[parent]
			this.data[parent] = this.data[pos];
			this.data[pos] = x;
			pos = parent;
		}else break;
	}
	return ++this.length;
}
HeapQueue.prototype.pop = function(){
	var ret = this.data[0],
		last_val = this.data.pop();
	this.length--;
	if(this.data.length > 0){
		this.data[0] = last_val;
		var pos = 0,
			last = this.data.length - 1,
			left, right, minIndex, x;
		while(1){
			left = (pos << 1) + 1;
			right = left + 1;
			minIndex = pos;
			if(left <= last && this.cmp(this.data[left], this.data[minIndex]) < 0) minIndex = left;
			if(right <= last && this.cmp(this.data[right], this.data[minIndex]) < 0) minIndex = right;
			if(minIndex !== pos){
				x = this.data[minIndex]
				this.data[minIndex] = this.data[pos]
				this.data[pos] = x;
				pos = minIndex
			}else break;
		}
	}
	return ret
}

// This file isn't very well documented, but that shouldn't be a huge problem
// because most of this is a fairly straightforward port of the scikit-image
// implementation which can be found in 
// https://github.com/chintak/scikit-image/blob/inpaint/skimage/filter/_inpaint_fmm.pyx

function InpaintTelea(width, height, image, mask, radius){
	if(!radius) radius = 5;

	var LARGE_VALUE = 1e6;
	var SMALL_VALUE = 1e-6;

	var size = width * height;
	var flag = new Uint8Array(size);
	var u = new Float32Array(size);
	
	for(var i = 0; i < size; i++){
		if(!mask[i]) continue;
		// this is the equivalent of doing a morphological dilation with
		// a 1-pixel cross structuring element for first pass through flag
		flag[i + 1] = flag[i] = flag[i - 1] = flag[i + width] = flag[i - width] = 1;
	}
	
	for(var i = 0; i < size; i++){
		flag[i] = (flag[i] * 2) - (mask[i] ^ flag[i])
		if(flag[i] == 2) // UNKNOWN
			u[i] = LARGE_VALUE;
	}


	var heap = new HeapQueue(function(a, b){ return a[0] - b[0] }) // sort by first thingy
	
	for(var i = 0; i < size; i++){
		if(flag[i] == 1) // BAND
			heap.push([u[i], i]);
	}
	
	var indices_centered = []
	// generate a mask for a circular structuring element
	for(var i = -radius; i <= radius; i++){
		var h = Math.floor(Math.sqrt(radius * radius - i * i))
		for(var j = -h; j <= h; j++)
			indices_centered.push(i + j * width);
	}

	function eikonal(n1, n2){
		var u1 = u[n1],
			u2 = u[n2];
		if(flag[n1] == 0 /*KNOWN*/){
			if(flag[n2] == 0 /*KNOWN*/){
				var perp = Math.sqrt(2 - Math.pow(u1 - u2, 2)); // perpendicular distance
				var s = (u1 + u2 - perp) * 0.5; // average distance
				if(s >= u1 && s >= u2) return s;
				s += perp;
				if(s >= u1 && s >= u2) return s;
			}else{
				return 1 + u1
			}
		}else if(flag[n2] == 0 /*KNOWN*/){
			return 1 + u2;
		}
		return LARGE_VALUE
	}

	function inpaint_point(n){
		var norm = 0;
		// var Ia = 0;
		var Ra = 0, Ga = 0, Ba = 0;

		// var Jx = 0, Jy = 0;
		var gradx_u = grad_func(u, n, 1),
			grady_u = grad_func(u, n, width); 
		
		var i = n % width,
			j = Math.floor(n / width);


		for(var k = 0; k < indices_centered.length; k++){
			var nb = n + indices_centered[k];
			var i_nb = nb % width,
				j_nb = Math.floor(nb / width);

			if(i_nb <= 1 || j_nb <= 1 || i_nb >= width - 1 || j_nb >= height - 1) continue;

			if(flag[nb] != 0 /*KNOWN*/) continue; 

			var rx = i - i_nb,
				ry = j - j_nb;

			var geometric_dst = 1 / ((rx * rx + ry * ry) * Math.sqrt(rx * rx + ry * ry))
			var levelset_dst = 1 / (1 + Math.abs(u[nb] - u[n]))
			var direction = Math.abs(rx * gradx_u + ry * grady_u);
			var weight = geometric_dst * levelset_dst * direction + SMALL_VALUE;
			// var gradx_img = grad_func(image, nb, 1) + SMALL_VALUE,
			// 	grady_img = grad_func(image, nb, width) + SMALL_VALUE;
			
			// Ia += weight * image[nb]

			// this is the no-op color meaning that we've hit the background
			// and thus should abandon ship or something
			if(image[nb * 4] == 250 && image[nb * 4 + 1] == 254 && image[nb * 4 + 2] == 252){
				// walp
			}else{
				Ra += weight * image[nb * 4]
				Ga += weight * image[nb * 4 + 1]
				Ba += weight * image[nb * 4 + 2]	
				norm += weight
			}
			// Jx -= weight * gradx_img * rx
			// Jy -= weight * grady_img * ry
		}
		// the fmm.py which this is based on actually implements a slightly different
		// algorithm which apparently "considers the effect of gradient of intensity value"
		// which is some kind of voodoo magic that I don't understand which is apparently
		// in the OpenCV implementation. Unless I've been porting the algorithm wrong,
		// which is certainly a possibility and I invested quite a bit of effort into
		// that hypothesis by way of rewriting and checking every line of code a few
		// times. 
		// image[n] = Ia / norm;
		if(norm > 0){
			image[n * 4] = Ra / norm
			image[n * 4 + 1] = Ga / norm
			image[n * 4 + 2] = Ba / norm	
		}
		
		// image[n] = Ia / norm + (Jx + Jy) / Math.sqrt(Jx * Jx + Jy * Jy);
	}



	// this is meant to return the x-gradient
	function grad_func(array, n, step){
		if(flag[n + step] != 2 /* UNKNOWN */){
			if(flag[n - step] != 2){
				return (array[n + step] - array[n - step]) * 0.5
			}else{
				return array[n + step] - array[n]
			}
		}else{
			if(flag[n - step] != 2){
				return array[n] - array[n - step]
			}else{
				return 0
			}
		}
	}


	while(heap.length){
		var n = heap.pop()[1];
		var i = n % width,
			j = Math.floor(n / width);
		flag[n] = 0; // KNOWN
		if(i <= 1 || j <= 1 || i >= width - 1 || j >= height - 1) continue;
		for(var k = 0; k < 4; k++){
			var nb = n + [-width, -1, width, 1][k];
			if(flag[nb] != 0){ // not KNOWN
				u[nb] = Math.min(eikonal(nb - width, nb - 1),
                                 eikonal(nb + width, nb - 1),
                                 eikonal(nb - width, nb + 1),
                                 eikonal(nb + width, nb + 1));
				if(flag[nb] == 2){ // UNKNOWN
					flag[nb] = 1; // BAND
					heap.push([u[nb], nb])
					inpaint_point(nb)
				}
			}
		}
	}
	
	var output = new Uint8ClampedArray(image.length);
	
	for(var i = 0; i < size; i++){
		if(mask[i]){
			output[i * 4] = image[i * 4]
			output[i * 4 + 1] = image[i * 4 + 1]
			output[i * 4 + 2] = image[i * 4 + 2]
			output[i * 4 + 3] = image[i * 4 + 3]	
		}
		
	}
	return output
}

if(typeof IMPORTED == 'undefined') 
	importScripts('inpaint.js', 
				'../lib/jsfeat-basic.js', 
				'../lib/color.js', 
				'../mask/mask.js');

onmessage = function(e){
	// postMessage(e.data)
	var dat = e.data;
	var image = dat.image;

	var letters = get_letters(dat.region);
	var marker = resize_contours({
		letters: letters,
		region: dat.region,
		sw: dat.image2x.width,
		sh: dat.image2x.height,
		mskscale: dat.mskscale,
		swtscale: dat.swtscale,
		swtwidth: dat.swtwidth,
		xpad: dat.xpad,
		ypad: dat.ypad
	})
	// postMessage({visualize: marker})
	var filtered = simple_filter(single_dilation(marker), dat.image2x)
	// postMessage({visualize: filtered})
	var pre_mask = simple_reconstruct(filtered.mask, marker, letters);
// postMessage({visualize: pre_mask})
	var mask = halve_dilation(single_dilation(single_dilation(pre_mask)));
	// postMessage({visualize: mask})
	// find shadows
	var dilation = erode_contours((mask));
	// postMessage({visualize: dilation})
	// var dilation = mask;
	// var last_avg = -1;
	// var last_diff = 0;
	var avgs = []
	for(var j = 0; j < 10; j++){
		var step = single_dilation(dilation)
		// var frontier = subtract_mask(dilation, mask);
		var lumasum = 0, frontlen = 0;
		for(var i = 0; i < dilation.data.length; i++){
			if(!step.data[i] || dilation.data[i]) continue;
			// if(step.data[i] && !dilation.data[i]) continue;
			var r = image.data[i * 4],
				g = image.data[i * 4 + 1],
				b = image.data[i * 4 + 2];

			var luma = 0.299 * r + 0.587 * g + 0.114 * b;
			// if(r == 255 && g == 255 && b == 255){
			if(r == 250 && g == 254 && b == 252){
				// oh noes, we've reached the edge of the image
				// there should honestly be a better way to signal
				// that we've reached the edge than this super common color though
			}else{
				lumasum += luma || 0;
				frontlen++	
			}
			
		}
		// for(var r = 250; r < 256; r++){
		// 	for(var g = 250; g < 256; g++){
		// 		for(var b = 250; b < 256; b++){
		// 			console.log(r.toString(16) + g.toString(16) + b.toString(16))
		// 		}
		// 	}
		// }
		// fdfafa ~ 113k
		// fbfcfc ~ 151k
		// fafdfd ~ 105k
		// fafefc ~ 24k
		
		// console.log(lumasum / frontlen)
		var avg = lumasum / frontlen;
		if(!isNaN(avg))
			avgs.push(avg);
		// console.log(avg)
		// var diff = avg - last_avg;
		// if(last_avg > 0){


		// 	if(diff > 20 && avg > 100){
		// 		mask = dilation;
		// 		break;
		// 	}

		// }
		// console.log(diff)
		// last_avg = avg;
		// console.log(diff - last_diff)
		// last_diff = diff;
		// postMessage(lumasum / frontlen)
		dilation = step;
		// mask = dilation

	}
	// postMessage({visualize: marker})

	var diff = Math.max.apply(Math, avgs) - Math.min.apply(Math, avgs)
	// postMessage(avgs.join(', '))
	if(diff > 30 && avgs[0] < 85){
		// postMessage(avgs.join(', '))
		var win = 10;	
		var target = Math.max.apply(Math, avgs) - win;
		for(var i = 0; i < avgs.length; i++){
			if(avgs[i] > target){
				var dilation = mask;
				for(var j = 0; j < i; j++){
					// postMessage('new layer '+j)
					dilation = single_dilation(dilation)
				}
				mask = dilation;
				break;
			}
		}	
	}
	

	// remove the top row and bottom row
	for(var i = 0; i < mask.cols; i++){
		mask.data[mask.data.length - i] = mask.data[i] = 0;
	}
	// left and right
	for(var i = 0; i < image.height; i++){
		mask.data[i * image.width] = 0;
		mask.data[(i + 1) * image.width - 1] = 0;
	}

	var output = InpaintTelea(image.width, image.height, image.data, mask.data)
	// var output = InpaintTelea(e.data.width, e.data.height, e.data.image, e.data.mask)
	postMessage({
		type: 'out',
		colors: filtered.colors,
		image: output
	})
	// postMessage(e.data.image)
}


function simple_filter(mask, src){
	// what is the radius of the structuring element for our morphological dilation
	var dilrad = 10;

	
	var width = src.width,
		height = src.height;

	// perhaps we should use a circular structuring element
	// instead of a box because that means less pixel fills
	// which might be faster, because maybe we should pre
	// cache all thse offsets anyway

	var marker = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
	var dilation = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
	

	console.time('morphological dilation')

	var dilation = mask;
	for(var i = 0; i < dilrad; i++){
		dilation = single_dilation(dilation)
	}

	for(var i = 0; i < mask.data.length; i++){
		if(!mask.data[i]) continue;
		dilation.data[i] = 2;
	}

	// visualize_matrix(dilation)

	// postMessage({visualize: dilation})


	console.timeEnd('morphological dilation')

	
	var pixmap = new Uint16Array(width * height)
	var intoct = new Uint32Array(16 * 16 * 16)
	var extoct = new Uint32Array(16 * 16 * 16)
	// var zeroes = new Uint32Array(16 * 16 * 16)

	var labtab = {};

	console.time("color filter")
	

	for(var y = 0; y < height; y++){
		for(var x = 0; x < width; x++){
			var p = x + y * width;

			var rgb_color = Math.floor(src.data[4 * p] / 8) + 
							Math.floor(src.data[4 * p + 1] / 8) * 32 + 
							Math.floor(src.data[4 * p + 2] / 8) * 1024;
			// here we round the color kinda to speed up rgb->lab conversion
			// because the conversion is kinda slow

			if(!(rgb_color in labtab)){

				var lab = rgb2lab([src.data[4 * p], src.data[4 * p + 1], src.data[4 * p + 2]])
				// var color =     Math.floor((2 * lab[0] + 30) / 16) + 
				// 				Math.floor((lab[1] + 130) / 16) * 16 + 
				// 				Math.floor((lab[2] + 130) / 16) * 256
				var color = Math.round((lab[0] + 40) / 16) |
							Math.round((lab[1] + 128) / 16) << 4 |
							Math.round((lab[2] + 128) / 16) << 8;

				labtab[rgb_color] = color					
			}else{
				var color = labtab[rgb_color]
			}

			pixmap[p] = color
			if(dilation.data[p] === 1){
				extoct[color]++
				extoct[color+16]++
				extoct[color-16]++
				extoct[color+256]++
				extoct[color-256]++
				extoct[color+1]++
				extoct[color-1]++
			}else if(dilation.data[p] === 2){
				intoct[color]++
				intoct[color+16]++
				intoct[color-16]++
				intoct[color+256]++
				intoct[color-256]++
				intoct[color+1]++
				intoct[color-1]++
			}
		}
	}

	// var ratmap = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
	for(var y = 0; y < height; y++){
		for(var x = 0; x < width; x++){
			var p = x + y * width;
			var color = pixmap[p]
			if(intoct[color] > extoct[color]){
				marker.data[p] = 1
			}
			// ratmap.data[p] = Math.min(255, intoct[color] / extoct[color])
		}
	}

	// postMessage({visualize: ratmap})


	console.timeEnd('color filter')


	console.time('color clustering')
	// perhaps k-means or connected components would be better
	

	var midoct = new Uint32Array(16 * 16 * 16)
	var shrunk = (erode_contours(mask))

	for(var y = 0; y < height; y++){
		for(var x = 0; x < width; x++){
			var p = x + y * width;
			if(!shrunk.data[p]) continue;

			var rgb_color = Math.floor(src.data[4 * p] / 8) + 
							Math.floor(src.data[4 * p + 1] / 8) * 32 + 
							Math.floor(src.data[4 * p + 2] / 8) * 1024;
			// here we round the color kinda to speed up rgb->lab conversion
			// because the conversion is kinda slow

			var color = labtab[rgb_color]
			midoct[color]++
		}
	}
	// postMessage({visualize: shrunk})
	// postMessage({visualize: grown})


	var maroct = new Uint8Array(16 * 16 * 16)

	// var dl = [], da = [], db = []
	// for(var i = -1; i <= 1; i++){
	// 	for(var j = -1; j <= 1; j++){
	// 		for(var k = -1; k <= 1; k++){
	// 			if(i == j && j == k && k == 0){
					
	// 			}else{
	// 				// console.log(i, j, k)
	// 				dl.push(i)
	// 				da.push(j)
	// 				db.push(k)
	// 			}
	// 		}
	// 	}
	// }
	// console.log(dl, da, db)


	// var invmap = {}
	// for(var i in labtab){
	// 	invmap[labtab[i]] = [(i % 32) * 8, (Math.floor(i / 32) % 32) * 8, (Math.floor(i / 1024)) * 8 ]
	// }
	


	// do a three dimensional connected components on the L*a*b space
	// and then for each connected cluster, we take the weighted arithmetic
	// mean and convert back to rgb coordinates
	var dl = [-1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
		da = [-1, -1, -1, 0, 0, 0, 1, 1, 1, -1, -1, -1, 0, 0, 1, 1, 1, -1, -1, -1, 0, 0, 0, 1, 1, 1],
		db = [-1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1, -1, 0, 1]

	var clusters = []
	for(var color = 0; color < midoct.length; color++){
		if(midoct[color] == 0 || maroct[color]) continue;
		// var weight = midoct[color] / (1 + extoct[color]);
		// if(weight < 2) continue;
		maroct[color] = 1;
		var contour = [];
		var stack = [color];
		var closed;
		
		var cl = (color     ) & 15,
			ca = (color >> 4) & 15,
			cb = (color >> 8);
		
		while(closed = stack.shift()){
			contour.push(closed)
			for(var k = 0; k < 26; k++){
				var nl = cl + dl[k],
					na = ca + da[k],
					nb = cb + db[k];
				
				var ncolor = nl | (na << 4) | (nb << 8);

				if( nl >= 0 && nl < 16 &&
					na >= 0 && na < 16 &&
					nb >= 0 && nb < 16 &&
					!maroct[ncolor] &&
					midoct[ncolor]
					// midoct[ncolor] / (1 + extoct[ncolor]) > 1
					){
					// weight += midoct[ncolor] / (1 + extoct[ncolor])

					maroct[ncolor] = 1
					stack.push(ncolor)
				}
			}
		}
		
		var wl = 0, wa = 0, wb = 0, wt = 0;

		for(var i = 0; i < contour.length; i++){
			var ncolor = contour[i];
			
			var w = midoct[ncolor] // (1 + extoct[ncolor]);

			var nl = (ncolor     ) & 15,
				na = (ncolor >> 4) & 15,
				nb = (ncolor >> 8);

			var l = (nl * 16 - 40),
				a = (na * 16 - 128),
				b = (nb * 16 - 128);

			
			wt += w;
			wl += l * w;
			wa += a * w;
			wb += b * w;
		}

		// postMessage({})

		
		// postMessage({ log: [contour.length] })
		// var ncolor = contour.sort(function(a, b){
		// 	var wa = intoct[a] * intoct[a] / (1 + extoct[a]),
		// 		wb = intoct[b] * intoct[b] / (1 + extoct[b]);
		// 	return b - a
		// })[0];

		// var nl = (ncolor     ) & 15,
		// 	na = (ncolor >> 4) & 15,
		// 	nb = (ncolor >> 8)
		// var l = (nl * 16 - 40),
		// 	a = (na * 16 - 128),
		// 	b = (nb * 16 - 128);

		// var rgb = lab2rgb([l, a, b])
		var rgb = lab2rgb([wl / wt, wa / wt, wb / wt])
		

		// postMessage({ log:  (wt) + " nuxm " + rgb + (width * height),
		// 	intoct: intoct, extoct: extoct, contour: contour })


		// console.log('wow such cluster', weight, wl, wa, wb, rgb)
		// console.log(contour)

		clusters.push([wt, rgb])
	}
	console.timeEnd('color clustering')

	return {
		mask: marker,
		colors: clusters.sort(function(b, a){ return a[0] - b[0] })
	}
}


function simple_reconstruct(filtered, marker, letters){
	var recon = new jsfeat.matrix_t(filtered.cols, filtered.rows, jsfeat.U8C1_t)

	var dx8 = [-1, 1, -1, 0, 1, -1, 0, 1];
	var dy8 = [0, 0, -1, -1, -1, 1, 1, 1];

	var queued = new jsfeat.matrix_t(filtered.cols, filtered.rows, jsfeat.U8C1_t)
	
	for(var i = 0; i < filtered.cols * filtered.rows; i++){
		if(queued.data[i] || !filtered.data[i]) continue;

		var ix = i % filtered.cols, iy = Math.floor(i / filtered.cols)
		
		queued.data[i] = 1
		var is_glyph = false;
		var contour = []
		var stack = [i]
		var closed;
		

		while(closed = stack.shift()){
			contour.push(closed)
			var cx = closed % filtered.cols, cy = Math.floor(closed / filtered.cols);
			var w = filtered.data[closed];
			for(var k = 0; k < 8; k++){
				var nx = cx + dx8[k]
				var ny = cy + dy8[k]
				var n = ny * filtered.cols + nx;

				if(nx >= 0 && nx < filtered.cols &&
				   ny >= 0 && ny < filtered.rows &&
				   filtered.data[n] &&
				   !queued.data[n]){
				   	if(!is_glyph && marker.data[n]){
				   		is_glyph = true;
				   	}
					queued.data[n] = 1
					// update the average stroke width
					stack.push(n)
				}
			}
		}

		if(contour.length < 2){
			for(var j = 0; j < contour.length; j++){
				recon.data[contour[j]] = 1
			}
			continue;
		}

		// postMessage({log: 'done contour'+i})
		// contours.push(contour)
		var accept = false;
		if(is_glyph){
			accept = true;
		}else{
			var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;

	// postMessage({log: 'cont'+contour.length})
			for(var i = 0; i < contour.length; i++){
				var x = contour[i] % filtered.cols,
					y = Math.floor(contour[i] / filtered.cols);
				x0 = Math.min(x0, x); y0 = Math.min(y0, y);
				x1 = Math.max(x1, x); y1 = Math.max(y1, y);
			}
			var sw = x1 - x0 + 1, sh = y1 - y0 + 1;
			var ratio = Math.max(sw, sh) / Math.min(sw, sh);

			// specks can not intersect with letters
			// var intersects = letters.some(function(a){
			// 	var sw = Math.min((a.x1 - box.x0) * s, x1) - Math.max((a.x0 - box.x0) * s, x0),
			// 		sh = Math.min((a.y1 - box.y0) * s, y1) - Math.max((a.y0 - box.y0) * s, y0)
			// 	return sw > -5 && sh > -5
			// })

			// console.log(sh, sw, y1, y0, contour)
			var touches_edge = x0 == 0 || x1 == filtered.cols - 1 || y0 == 0 || y1 == filtered.rows - 1;

			if(contour.length < 1000 && 
			   sw / sh < 20 &&
			   sh / sw < 20 &&
			   !touches_edge){
				accept = true
			}
		}

		if(accept){
			for(var j = 0; j < contour.length; j++){
				recon.data[contour[j]] = 1
			}
		}
	}
	return recon
}

function single_dilation(mask){
	var mydriatic = new jsfeat.matrix_t(mask.cols, mask.rows, jsfeat.U8C1_t);
	for(var i = 0; i < mask.data.length; i++){
		if(!mask.data[i]) continue;
		mydriatic.data[i] = mydriatic.data[i - 1] = mydriatic.data[i + 1] = mydriatic.data[i - mask.cols] = mydriatic.data[i + mask.cols] = 1
	}
	return mydriatic
}
function subtract_mask(dilation, mask){
	var sub = new jsfeat.matrix_t(mask.cols, mask.rows, jsfeat.U8C1_t);
	for(var i = 0; i < mask.data.length; i++){
		sub.data[i] = dilation.data[i] && !mask.data[i];
	}
	return sub
}

function halve_dilation(mask){
	var half = new jsfeat.matrix_t(mask.cols / 2, mask.rows / 2, jsfeat.U8C1_t);
	for(var i = 0; i < half.data.length; i++){
		var x = i % half.cols,
			y = Math.floor(i / half.cols);

		half.data[i] = mask.data[x * 2 + 2 * y * mask.cols] || 
						mask.data[x * 2 + 1 + 2 * y * mask.cols] || 
						mask.data[x * 2 + 1 + (2 * y + 1) * mask.cols] || 
						mask.data[x * 2 + (2 * y + 1) * mask.cols];
	}
	return half
}
