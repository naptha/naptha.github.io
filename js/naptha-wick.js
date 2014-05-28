// I guess this happens to be the first file which gets included
// so I might as well use this to write a message here for whoever
// ends up reading this


function uuid(){
	for(var i = 0, s, b = ''; i < 42; i++)
		if(/\w/i.test(s = String.fromCharCode(48 + Math.floor(75 * Math.random())))) b += s;
	return b;	
}

/**
 * Display an image in the console.
 * @param  {string} url The url of the image.
 * @param  {int} scale Scale factor on the image
 * @return {null}
 * http://dunxrion.github.io
 */
console.image = function(url, log) {
	var img = new Image();
	function getBox(width, height) {
		return {
			string: "+",
			style: "font-size: 1px; padding: " + Math.floor(height/2) + "px " + Math.floor(width/2) + "px; line-height: " + height + "px;"
		}
	}
	img.onload = function() {
		var dim = getBox(this.width, this.height);
		console.log(log, url)
		console.log("%c" + dim.string, dim.style + "background: url(" + url + "); background-size: " + (this.width) + "px " + (this.height) + "px; color: transparent;");
	};

	img.src = url;
};

var global_params = {
    ocrad_worker: 'js/ocrad-worker.js',
    swt_worker: 'js/swt-worker.js',
    inpaint_worker: 'js/inpaint-worker.js',
    mask_worker: 'js/mask-worker.js',
    num_workers: 2,
    is_extension: true,
    queue_expires: 1000 * 2, // two seconds
    user_id: null
}


// maybe a better spot for this would be in default_params
// TODO: figure out how the params system shoudl work

function load_user_id(){
	chrome.storage.sync.get(['user_id'], function(value){
		if(value['user_id']){
			global_params.user_id = value['user_id'];
		}else{
			chrome.storage.sync.set({'user_id': uuid()}, function(){
				load_user_id()
			})
		}
	})
}


load_user_id()


var storage_cache = {
	warn_ocrad: true
};

function load_settings(){
	chrome.storage.sync.get(['settings'], function(val){
		var settings = val['settings']
		// console.log('loaded settings', settings)
		if(settings){
			for(var i in settings){
				storage_cache[i] = settings[i];
			}	
		}else{
			save_settings()
		}
	})

}

chrome.storage.onChanged.addListener(function(changes, namespace){
	load_settings()
})

load_settings()

function get_setting(name){ return storage_cache[name] }

function save_settings(){
	// console.log('save settings', storage_cache)
	chrome.storage.sync.set({
		settings: storage_cache
	})
}

function put_setting(name, val){
	storage_cache[name] = val;
	save_settings()
}

function broadcast(data){
	// console.log('sending', data)
	chrome.runtime.sendMessage(data)

	
	// if(chrome.runtime.lastError) console.log('error');
	// var fr = document.getElementById('project_naptha_core_frame')
	// if(fr && fr.contentWindow){
	// 	fr.contentWindow.postMessage(data, location.protocol + '//' + location.host)	
	// }else{
	// 	// oops this shit dont exist yet
		
	// 	broadcast_queue.unshift(data)

	// 	if(!fr){
	// 		var fr = document.createElement('iframe')
	// 		fr.src = 'core.html'
	// 		fr.id = 'project_naptha_core_frame'
	// 		fr.style.display = 'none'
	// 		get_container().appendChild(fr)
	// 	}
	// }
}



chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
//     console.log(sender.tab ?
//                 "from a content script:" + sender.tab.url :
//                 "from the extension");
// if (request.greeting == "hello")
//   sendResponse({farewell: "goodbye"});
	receive(request)
});


// document.addEventListener('myCustomEvent', function() {
// //   // var eventData = document.getElementById('myCustomEventDiv').innerText;
// //   // port.postMessage({message: "myCustomEvent", values: eventData});
// });
var session_params = {
	// show_chunks: true,
	// show_regions: true,
	// show_lines: true,
	// show_contours: true
}


var default_params = {
	// the kernel size for the gaussian blur before canny
	kernel_size: 3,
	// low and high thresh are parameters for the canny edge detector
	low_thresh: 124,
	high_thresh: 204,
	// maximum stroke width, this is the number of iterations
	// the core stroke width transform loop will go through 
	// before giving up and saying that there is no stroke here
	max_stroke: 35,
	// the maximum ratio between adjacent strokes for the 
	// connected components algorithm to consider part of the
	// same actual letter
	stroke_ratio: 2,
	// this is the pixel connectivity required for stuff to happen
	min_connectivity: 4,
	// the minimum number of pixels in a connected component to
	// be considered a candidate for an actual letter
	min_area: 30, //default: 38
	// maximum stroke width variation allowed within a letter
	std_ratio: 0.83,
	// maximum aspect ratio to still be considered a letter
	// for instance, a really long line wouldn't be considered
	// a letter (obviously if this number is too low, it'll start
	// excluding l's 1's and i's which would be bad)
	aspect_ratio: 10, // default: 8
	// maximum ratio between the median thicknesses of adjacent 
	// letters to be considered part of the same line
	thickness_ratio: 3,
	// maximum ratio between adjacent letter heights to be considered
	// part of the same line
	height_ratio: 2.5, // original: 1.7
	
	// for some reason it's much more effective with non-integer scales
	scale: 1.3,
	// scale: 1.8,

	// text_angle: Math.PI / 6
	letter_occlude_thresh: 7, //default 3
	
	// otsu parameter for word breakage
	breakdown_ratio: 0.4,
	// something something making lines
	elongate_ratio: 1.9,
	// maximum number of surrounding pixels to explore during the
	// flood fill swt augmentation stage
	max_substroke: 15,
	// linespacing things for spacing lines, used in forming paragraphs/regions
	min_linespacing: 0.1, // this is for overlap
	max_linespacing: 1.7,
	// otsu breakdown ratio for splitting a paragraph
	col_breakdown: 0.3,
	// the maximum fraction of the width of the larger of two adjacent lines 
	// by which an alignment may be offset in one column
	max_misalign: 0.1,
	// the first one is frac of the smaller area, the second is frac of bigger area
	col_mergethresh: 0.3,

	lettersize: 0.4, // maximum difference between median letter weights of adjacent lines
	// letter weight is defined as the number of pixels per letter divided by the width
	// which is because quite often entire words get stuck together as one letter
	// and medians are used because it's a more robust statistic, this actually works
	// remarkably well as a metric

	// debugs!?!?
	debug: false,
	
	chunk_size: 250,
	chunk_overlap: 90,
	
	apiroot: "https://sky-lighter.appspot.com/api/"
	// apiroot: "http://localhost:8080/api/"
}

var session_id = uuid()
var image_counter = 0;
var images = {};

function get_id(img){
	if(!img) return;
	// if you're passing an id, return the id
	if(typeof img == 'string') return img;
	function clean(str){
		// return str.replace(/^.+:\/\//g, '').replace(/[^a-z.\/_]/gi, '')
		return str.replace(/[^a-z0-9.\/_\-]/gi, '')
	}
	if(!('__naptha_id' in img)){
		var readable = clean(img.src.replace(/^.*\/(.*)$/g, '$1').split('.')[0]);
		img.__naptha_id = (image_counter++) + '**' + readable + '**' + clean(img.src) + '**' + session_id;
		if(global_params.simple_ids){
			img.__naptha_id = readable
		}
	}
	return img.__naptha_id
}

function im(img){
	var id = get_id(img)
	if(id in images) return images[id];
	

	function shallow(obj){
		var new_obj = {};
		for(var i in obj){
			new_obj[i] = obj[i]
		}
		return new_obj;
	}

	var params = shallow(default_params);
	
	var src = img.src;

	if(src.indexOf("http://localhost/Dropbox/Projects/naptha/") == 0){
		src = "demo:" + img.src.replace(/^.*\/(.*?)\..*?$/g, '$1')
	}

	var image = images[id] = {
		id: id,
		el: img,
		width: Math.round(img.naturalWidth * params.scale),
		height: Math.round(img.naturalHeight * params.scale),
		src: src,
		real_src: img.src,
		chunks: [],
		regions: [],
		engine: 'default',
		params: params
	}
	
	collect_contexts()

	return image;
}

function receive(data){
	if(data.type == 'getparam'){
		var image = im(data.id)
		broadcast({
			type: 'gotparam',
			id: image.id,
			src: image.src,
			real_src: image.real_src,
			params: image.params,
			initial_chunk: data.initial_chunk
		})
	}else if(data.type == 'region'){
		var image = im(data.id)
		
		// var old_regions = {}
		
		// image.regions.forEach(function(e){ old_regions[e.id] = e; })

		// // if you had an old, finished column, keep the same
		// // object rather than replacing it with the exact
		// // same new one

		// image.regions = data.regions.map(function(e){
		// 	if(e.id in old_regions && old_regions[e.id].finished){
		// 		return old_regions[e.id]
		// 	}else{
		// 		return e
		// 	}
		// })

		image.regions = data.regions

		image.chunks = data.chunks
		image.stitch_debug = data.stitch_debug
		// if(sel.img && image.id == get_id(sel.img)){
		// 	render_selection(image.el, get_selection(sel, image), image.params)	
		// }

		update_selection()

		draw_annotations(image.el, image)
	}else if(data.type == 'painted'){
		// console.log(data.reg_id)
		var image = im(data.id)
		
		var mask = new Image()
		mask.style.webkitTransform = 'translateZ(0)'
		mask.src = data.plaster;

		if(!image.plaster) image.plaster = {};
		
		image.plaster[data.reg_id] = {
			mask: mask,
			colors: data.colors,
			x: data.x,
			y: data.y,
			width: data.width,
			height: data.height,
			finished: Date.now()
		}

		update_overlay(image.el)
		
		init_layer(mask, 'plaster')
		var sx = (image.el.width / image.el.naturalWidth),
			sy = (image.el.height / image.el.naturalHeight);

		mask.style.left = (sx * data.x) + 'px'
		mask.style.top = (sy * data.y) + 'px'
		
		mask.style.width = (sx * data.width) + 'px'
		mask.style.height = (sy * data.height) + 'px'

		mask.style.transition = 'opacity 1s'
		mask.style.opacity = '0'
		image.overlay.appendChild(mask)

		// update_translations(image)
		image.regions.forEach(function(region){
			if(region.id == data.reg_id){
				translate_region(image, region)
			}
		})
		draw_overlays(image)
		update_selection();
	}else if(data.type == 'recognized'){
		var image = im(data.id)
		if(!image.ocr) image.ocr = {};
		
		// console.log(data)

		var plain_text = data.text;
		try {
			plain_text = JSON.parse(plain_text).text
		} catch (err) {
			if(data.enc == 'tesseract'){
				data.enc = 'error'
			}
		}
		
		if(data.enc == 'error' || /^ERROR/i.test(plain_text)){
			image.regions.forEach(function(region){
				if(region.id == data.reg_id){
					error_message(image, region, plain_text)
				}
			})
			delete image.ocr[data.reg_id]
			return
		}

		if(data.enc == 'tesseract'){
			var json = JSON.parse(data.text);
			var raw = parseTesseract(json)

			// if(!((image.lookup || {}).chunks || []).some(function(chunk){ return chunk.engine == data.engine })){
			;((image.lookup || {}).chunks || []).push({
				engine: data.engine,
				meta: json.meta,
				key: json.key
			})
			// }
		}else{
			var raw = data.raw;	
		}

		var ocr = image.ocr[data.reg_id];
		
		if(ocr._engine != data.engine) return;

		ocr.finished = Date.now()
		delete ocr.processing;

		// ocr.colors = data.colors;
		ocr.raw = raw
		ocr.text = data.text;



		var broken = raw.some(function(block){
			return isNaN(block.x) || isNaN(block.y)  || isNaN(block.w)  || isNaN(block.h)
		});

		if(broken){
			var ocr = image.ocr[data.reg_id];
			ocr.raw = null;
			ocr.error = true;
			ocr.text = 'ERROR: ' + data.text;
		}
		
		if(check_selection()) modify_clipboard();

		update_translations(image)

		draw_overlays(image)
		update_selection();
		
	}
}

function virtualize_region(image, region){
	function transform(region){
		if(image.translate && region.id in image.translate && image.translate[region.id].finished  && image.virtual && region.id in image.virtual){
			var lang = (image.translate[region.id] || {}).language
			if(lang && lang != 'erase') return image.virtual[region.id];
		}
		return region
	}
	if(region.map)
		return region.map(transform);
	return transform(region)
}



// function urlencode(obj){
// 	return Object.keys(obj).map(function(e){
// 		return e + '=' + encodeURIComponent(obj[e])
// 	}).join('&')
// }


function get_lookup_chunks(image, region){
	function frac_intersect(a, b){
		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
		var max_area = Math.max((1 + a.x1 - a.x0) * (1 + a.y1 - a.y0), 
								(1 + b.x1 - b.x0) * (1 + b.y1 - b.y0))
		return (width > 0 && height > 0) ? (width * height / max_area) : 0;
	}

	var filtered = ((image.lookup || {}).chunks || []).filter(function(chunk){
		// if(region.x0)
		// chunk.meta
		// check to see if its the right region
		var meta = chunk.meta;
		var intersect = frac_intersect({
			x0: meta.x0 / meta.sws,
			y0: meta.y0 / meta.sws,
			x1: meta.x1 / meta.sws,
			y1: meta.y1 / meta.sws
		}, {
			x0: region.x0 / image.params.scale,
			y0: region.y0 / image.params.scale,
			x1: region.x1 / image.params.scale,
			y1: region.y1 / image.params.scale
		});
		// console.log(intersect, meta, region)
		return meta.v == 3 && meta.dir == region.direction && intersect > 0.9

	})
	return filtered
}

function get_ocr_engine(image, region, def){
	var ocr = image.ocr[region.id]

	if(ocr.engine == 'default'){
		var filtered = get_lookup_chunks(image, region)
		// TODO: sort by popularity?
		return (filtered[0] && filtered[0].engine) || def || 'ocrad'

		// console.log(filtered, 'filteahz')
		// return "ocrad"
	}else{
		return ocr.engine;
	}
}





function ocr_region(image, col){

	if(!image.ocr) image.ocr = {};

	if(col.finished != true) return;
	
	if(!(col.id in image.ocr)){
		image.ocr[col.id] = {
			engine: "default"
		}
	}

	// console.log(col, "QUEUEING SOMETHING")
	// TODO: there's some code which exists that
	// filters out the virtual ones and it's like
	// not this
	if(col.virtual){
		for(var i = 0; i < image.regions.length; i++){
			if(image.regions[i].id == col.id)
				col = image.regions[i];
		}
	}

	var ocr = image.ocr[col.id];

	// var eng = ocr.engine == 'default' ? 'tess:eng' : ocr.engine;
	var eng = get_ocr_engine(image, col)

	if(ocr._engine != eng){
		ocr._engine = eng
		delete ocr.finished;
		delete ocr.processing;
	}

	if(ocr.finished || ocr.processing) return;

	delete ocr.waiting;
	
	
	var matches = get_lookup_chunks(image, col).filter(function(chunk){
		return chunk.engine == eng
	})


	if(ocr._engine != 'ocrad'){
		// gotta have lookup loaded or else cant do something

		if(!image.lookup){
			do_lookup(image)
		}else if(image.lookup.error){
			error_message(image, col, "Can't access lookup server.")
		}else if(!image.lookup.finished){
			setTimeout(function(){
				ocr_region(image, col)
			}, 100);
			return;
		}
	}

	if(matches.length > 0){
		// TODO:  figure out the ideal candidate

		var chunk = matches[0];
		var xhr = new XMLHttpRequest()
		xhr.open('GET', image.params.apiroot + 'read/' + chunk.key)
		xhr.send()
		xhr.onload = function(){
			// var result = JSON.parse(xhr.responseText);
			// console.log(parseTesseract(result))
			receive({
				type: 'recognized',
				enc: 'tesseract',
				reg_id: col.id,
				id: image.id,
				engine: eng,
				text: xhr.responseText
			})
		}
	}else{

		queue_broadcast({
			src: image.src,
			type: 'qocr',
			apiroot: image.params.apiroot,
			region: col,
			reg_id: col.id,
			id: image.id,
			engine: ocr._engine,
			swtscale: image.params.scale,
			swtwidth: image.width
		})		
	}


	// image.ocr[col.id] = { processing: Date.now() }
	image.ocr[col.id].processing = Date.now()
}



var broadcast_queue = [], is_casting = false;

function queue_broadcast(data){
	broadcast_queue.push(data)
	if(!is_casting) dequeue_broadcast();
}

function dequeue_broadcast(){
	is_casting = false
	if(broadcast_queue.length){
		broadcast(broadcast_queue.shift())
		setTimeout(dequeue_broadcast, 500)
		is_casting = true;
	}
}


// this function takes a y_orig, that is, a y coordinate in terms of the 
// dimensions of the original image and then returns an ordered list of
// chunks which may be involved (containing text pertaining to said coordinate)
// it may return up to two chunks, in which case the ordering refers to which
// block the text is "most likely" to reside on (but it could actually end
// up on the other one too)

function to_chunks(sY, image){
	var num_chunks = Math.max(1, Math.ceil((image.height - image.params.chunk_overlap) / (image.params.chunk_size - image.params.chunk_overlap)))
	var base = Math.min(num_chunks - 1, Math.floor(sY / (image.params.chunk_size - image.params.chunk_overlap)))
	var offset = sY - base * (image.params.chunk_size - image.params.chunk_overlap);
	
	if(base <= 0){
		return [0]
	}else if(offset < image.params.chunk_overlap / 2){
		return [base - 1, base]
	}else if(offset < image.params.chunk_overlap){
		return [base, base - 1]
	}else{
		return [base]
	}
}



function valid_image(img){
	// disable this for small links!
	if(!(
		img && 
		img.tagName == 'IMG' && 
		img.complete &&
		img.width > 150 && img.naturalWidth > 150 &&
		Math.min(img.width, img.naturalWidth) * Math.min(img.height, img.naturalHeight) > 19000 &&
		img.height > 60 && img.naturalHeight > 60 &&
		img.naturalWidth < 2000 &&
		img.src.length < 300 && // no really long urls
		img.ownerDocument.designMode != 'on' &&
		/^(https?|file):/i.test(img.src) // http, https or file protocols
	)) return false;

	var n = img, is_link = false;
	do {
	
		if(n.getAttribute('ocr') == 'off') return false;

		if(global_params.is_extension){
			if(n.getAttribute('ocr') == 'custom') return false;
		}

		if(n.tagName == 'A'){
			is_link = true;
		}
	
	} while ( (n = n.parentNode) && n.getAttribute);

	// this is kind of an odd test, it happens post-facto
	// that is, it happens after it's already been validated
	// and it might invalidate a valid image
	if(is_link && img.__naptha_id){
		var image = im(img);
		// hopefully this aint recursive
		var regpad = 10;
		var total_area = 0;
		image.regions.forEach(function(region){
			total_area += (regpad * 2 + region.width) * (regpad * 2 + region.height)
		})

		var frac_text = total_area / (image.width * image.height);


		if(frac_text > 0.85){
			// if it's a link and mostly text, then dont interfere with it
			return false;
		}
	}
	

	return true
		   
	// /zoom/.test(img.style.cursor) == false // the blown up image pics have un-preventable zoom effcts
}

function image_layout(el){
	var dim = el.getBoundingClientRect(),
		cmp = window.getComputedStyle(el);
	
	// if(dim.width == 0 || dim.height == 0){
	// 	delete images[get_id(el)]
	// 	dispose_overlay(el)
	// }
	function sty(prop){ return parseInt(cmp.getPropertyValue(prop), 10) }

	var X = dim.left + sty('padding-left') + sty('border-left-width'),
		Y = dim.top + sty('padding-top') + sty('border-top-width');

	return {
		width: el.width, height: el.height,
		X: X, Y: Y,
		left: scrollX + X, top: scrollY + Y
	}
}


function extract_region(ocr, start, end){
	var col = (start && start.region) || end.region;
	if(ocr.error){
		return [ ocr.text ];
	}
	if(!start || !start.line) start = { line: col.lines[0], region: col };
	if(!end || !end.line) end = { line: col.lines[col.lines.length - 1], region: col };

	if(start.line.id == end.line.id){
		return [extract_line(ocr, start, end)]
	}else{
		var within = false;
		return col.lines.map(function(line){
			if(line.id == start.line.id){
				within = true;
				return extract_line(ocr, start, null)
			}else if(line.id == end.line.id){
				within = false;
				return extract_line(ocr, null, end)
			}else if(within){
				return extract_line(ocr, { line: line, region: col })
			}
			return null
		}).filter(function(e){ return e })
	}	
}



function extract_line(ocr, start, end){
	var line = (start && start.line) || end.line; // one of them needs to have it defined
	var region = (start && start.region) || end.region; 
	var letters = [].concat.apply([], line.words.map(function(word){ return word.letters }))
	

	if(region.virtual){	
		return line.words.map(function(word){
			return word.letters.filter(function(letter){
				var rcx = letter.x0 / 2 + letter.x1 / 2;
				var in_range =  (!(start && start.letter) || rcx > start.letter.x0) && 
								(!(end && end.letter) || rcx < end.letter.x1);
				return in_range
			}).map(function(e){
				return e._
			}).join('')
		}).join(' ').trim()
	}

	var yr0 = Infinity, yr1 = -Infinity
	letters.forEach(function(letter){
		var y_pred = (letter.cx - line.cx) * Math.tan(line.angle) + line.cy
		yr0 = Math.min(yr0, letter.y0 - y_pred)
		yr1 = Math.max(yr1, letter.y1 - y_pred)
	})

	// var c = document.createElement('canvas')
	// c.width = 750
	// c.height = 500
	// var ctx = c.getContext('2d')
	// var blahe = new Image()
	// blahe.src = 'http://localhost/Dropbox/Projects/naptha/img/eink.jpg'
	// ctx.drawImage(blahe, 0, 0, blahe.width * region.scale, blahe.height * region.scale)


	var matches = ocr.raw.filter(function(rec){
		var rcx = (rec.x + rec.w / 2) * region.scale,
			rcy = (rec.y + rec.h / 2) * region.scale;

		var y_pred = (rcx - line.cx) * Math.tan(line.angle) + line.cy
		
		// ctx.fillRect(rcx, y_pred + yr0, 4, 1);
		// ctx.fillRect(rcx, y_pred + yr1, 4, 1);

		// ctx.strokeRect(rec.x * region.scale, rec.y * region.scale, rec.w * region.scale, rec.h * region.scale)

		var in_line = (rcy > y_pred + yr0 && rcy < y_pred + yr1)

		// if the lines dont exist there are no limits
		var in_range =  (!(start && start.letter) || rcx > start.letter.x0) && 
						(!(end && end.letter) || rcx < end.letter.x1);
		var is_rec = rec.matches.length > 0;
		
		return in_line && in_range && is_rec
	});

	// console.log('line', start, end, ocr, matches)

	// console.image(c.toDataURL('image/png'))

	return matches.sort(function(a, b){
		return (a.x + a.w) - (b.x + b.w)
	}).map(function(rec){
		if(rec.sw){
			// tesseract encodes its spaces as a startword flag
			return ' ' + rec.matches[0][0]
		}
		return rec.matches[0][0]
	}).join('').trim()
}



var PROCESSING_PREAMBLE = '<[ TEXT RECOGNITION IN PROGRESS / MORE INFO: http://projectnaptha.com/process/ '
var PROCESSING_CONCLUDE = ' / TEXT RECOGNITION IN PROGRESS ]>'

// http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
function RegEsc(s) { return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); };

var PROCESSING_MATCHER = new RegExp(RegEsc(PROCESSING_PREAMBLE) + '(.*?)' + RegEsc(PROCESSING_CONCLUDE), 'g')


function extract_selection(sel, image){
	var output = get_selection(sel, image).map(function(pair){
		var start = pair[0], 
			end = pair[1]
		
		var col = (start && start.region) || end.region;

		var locator = [
			col.id, 
			start && start.line && start.line.id, 
			end && end.line && end.line.id, 
			start && start.letter && start.letter.x0, 
			end && end.letter && end.letter.x1
		].map(function(e){ return e || '!' }).join('&')

		// synthesize_pair(null, locator)

		// if(!((col.id in image.ocr) && image.ocr[col.id].finished)){
		
		var variable = '(IDX:'+ locator +':XDI)'

		if(col.id in image.ocr && image.ocr[col.id].processing){
			variable += ' / ELAPSED ' + ((Date.now() - image.ocr[col.id].processing) / 1000).toFixed(2) + 'SEC'
		}

		variable += ' / DATE ' + (new Date).toUTCString()

		return PROCESSING_PREAMBLE + variable + PROCESSING_CONCLUDE;

		// return extract_region(image.ocr[col.id], start, end).join('\n').trim()
	}).join('\n\n')

	// actually, there's a good chance you could create an image
	// with text which matches the ocrad pattern and it might act
	// as a rather interesting glitch

	// i doubt it constitutes a serious vulnerability or problem
	// though, but it might be wise to fix this in future versions 
	// with some kind of padding or something

	var incomplete = 0;
	var has_ocrad = false;

	var text = substitute_recognition(output, function(region_id){
		if((region_id in image.ocr) && image.ocr[region_id].finished){
			var region = virtualize_region(image, image.regions.filter(function(region){
				return region.id == region_id
			})[0]);

			var ocr = image.ocr[region_id];

			if(ocr && ocr._engine == 'ocrad' && ocr.engine == "default") has_ocrad = true;

			return {
				region: region,
				ocr: ocr
			}
		}
		incomplete++
		return null;
	});
	// this is a little ocr thing that predicts basically whether or not something was
	// recognized poorly, it's just a kind of heuristic
	// var bad_ocr = /[^A-Z \.\,][A-Z\.\,]+/.test(text) || /[^a-z \.\,][a-z\.\,]+/.test(text);
	var bad_ocr = text.trim().split(/[\s\-\:\;\&\']+/).some(function(word){
		// short words are exempt
		if(word.length <= 2) return false;
		// all caps words are exempt
		if(word.toUpperCase() == word) return false;
		// if there exists a word which is like hELLO
		return !/^[A-za-z][a-z]*[a-z\.\'\"\,\-\!\?]$/.test(word)
	});

	if(bad_ocr && has_ocrad && typeof session_params == 'object' && session_params.warn_ocrad){
		text += '\n\nThis text was recognized by the built-in Ocrad engine. A better may be attained by changing the OCR Engine (under the Language menu) to Tesseract. This message can be removed in the future by unchecking "OCR Disclaimer" (under the Options menu). More info: http://projectnaptha.com/ocrad'
	}

	return {
		text: text,
		incomplete: incomplete
	}
}


function substitute_recognition(text, interactor){
	return text.replace(PROCESSING_MATCHER, function(all, interior){
		var locmat = interior.match(/\(IDX:(.*?):XDI\)/)
		if(locmat && locmat[1]){
			var locator = locmat[1];
			var loc = locator.split('&').map(function(e){ return e == '!' ? null : e })
			var dat = interactor(loc[0]);
			if(dat && dat.ocr){
				var region = dat.region;
				var start = {
					line: loc[1] && region.lines.filter(function(line){
						return line.id == loc[1]
					})[0],
					letter: loc[3] && { x0: loc[3] },
					region: region
				}
				var end = {
					line: loc[2] && region.lines.filter(function(line){
						return line.id == loc[2]
					})[0],
					letter: loc[4] && { x1: loc[4] },
					region: region
				}

				return extract_region(dat.ocr, start, end).join('\n').trim()
			}
		}
		return all
	});
}



function parseTesseract(response){
	var meta = response.meta;

	var rotw = (meta.x1 - meta.x0 + 1) / meta.sws * meta.cos + meta.xp * 2,
		roth = (meta.y1 - meta.y0 + 1) / meta.sws * meta.cos + meta.yp * 2;

	var text = response.text.trim();
	
	if(text.length == 0) return [];

	var raw = text.split('\n').map(function(e){
		var first = e.split('\t')[0];
		var d = first.trim().split(' ');
		var x = parseInt(d[0]),
			y = parseInt(d[1]),
			w = parseInt(d[2]),
			h = parseInt(d[3]),
			conf = parseFloat(d[4]);


		var cx = x + w / 2 - rotw / 2, 
			cy = y + h / 2 - roth / 2;

		var rcx = (cx * Math.cos(meta.ang) - cy * Math.sin(meta.ang) + rotw / 2) / meta.red,
			rcy = (cx * Math.sin(meta.ang) + cy * Math.cos(meta.ang) + roth / 2) / meta.red

		return {
			x: (rcx - w / 2 / meta.red) / meta.cos + meta.x0 / meta.sws - meta.xp,
			y: (rcy - h / 2 / meta.red) / meta.cos + meta.y0 / meta.sws - meta.yp,
			w: w / meta.red / meta.cos,
			h: h / meta.red / meta.cos,
			sw: /SW$/.test(first.trim()),
			matches: [ [e.slice(first.length + 1), conf] ]
		}
	})

	return raw;
}


function parseOcrad(response){
	var meta = response.meta;

	var rotw = (meta.x1 - meta.x0 + 1) / meta.sws * meta.cos + meta.xp * 2,
		roth = (meta.y1 - meta.y0 + 1) / meta.sws * meta.cos + meta.yp * 2;

	var raw = response.raw.map(function(e){
		return e.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*;\s*(\d+)(\,?.+)?$/)
	}).filter(function(e){
		return e
	}).map(function(e){
		var x = parseInt(e[1]),
			y = parseInt(e[2]),
			w = parseInt(e[3]),
			h = parseInt(e[4]),
			g = parseInt(e[5]);
	
		var matches = [];
		if(g > 0){
			var etc = e[6].trim();
			while(etc[0] == ',' && etc[1] == ' '){
				etc = etc.slice(2)
				var m = etc.match(/^\'(.+?)\'(\d+)/)
				matches.push([m[1], parseInt(m[2])])
				etc = etc.slice(m[0].length)
			}
		}
		
		if(matches.length != g){
			console.error('recognition count mismatch', g, matches)
		}
		// console.log(x, y, w, h, g, etc)
		var cx = x + w / 2 - rotw / 2, 
			cy = y + h / 2 - roth / 2;

		var rcx = (cx * Math.cos(meta.ang) - cy * Math.sin(meta.ang) + rotw / 2) / meta.red,
			rcy = (cx * Math.sin(meta.ang) + cy * Math.cos(meta.ang) + roth / 2) / meta.red

		return {
			// convert everything back to transformed scaled coordinates
			x: (rcx - w / 2 / meta.red) / meta.cos + meta.x0 / meta.sws - meta.xp,
			y: (rcy - h / 2 / meta.red) / meta.cos + meta.y0 / meta.sws - meta.yp,
			w: w / meta.red / meta.cos,
			h: h / meta.red / meta.cos,
			matches: matches
		}
	});
	
	return raw;
}
function UnionFind(count) {
  this.roots = new Array(count);
  this.ranks = new Array(count);
  
  for(var i=0; i<count; ++i) {
    this.roots[i] = i;
    this.ranks[i] = 0;
  }
}

UnionFind.prototype.length = function() {
  return this.roots.length;
}

UnionFind.prototype.makeSet = function() {
  var n = this.roots.length;
  this.roots.push(n);
  this.ranks.push(0);
  return n;
}

UnionFind.prototype.find = function(x) {
  var roots = this.roots;
  while(roots[x] !== x) {
    var y = roots[x];
    roots[x] = roots[y];
    x = y;
  }
  return x;
}


UnionFind.prototype.link = function(x, y) {
  var xr = this.find(x)
    , yr = this.find(y);
  if(xr === yr) {
    return;
  }
  var ranks = this.ranks
    , roots = this.roots
    , xd    = ranks[xr]
    , yd    = ranks[yr];
  if(xd < yd) {
    roots[xr] = yr;
  } else if(yd < xd) {
    roots[yr] = xr;
  } else {
    roots[yr] = xr;
    ++ranks[xr];
  }
}


// function link(root, root2){
//   var root = node[i]
//   while(root.parent){
//     root = root.parent;
//   }
//   var root2 = node[j];
//   while(root2.parent){
//     root2 = root2.parent;
//   }
//   if(root2 != root){
//     if(root.rank > root2.rank){
//       root2.parent = root;
//     }else{
//       root.parent = root2;
//       if(root.rank == root2.rank){
//         root2.rank++  
//       }
//       root = root2;
//     }
//     var node2 = node[j];
//     while(node2.parent){
//       var temp = node2;
//       node2 = node2.parent;
//       temp.parent = root;
//     }
//     var node2 = node[i];
//     while(node2.parent){
//       var temp = node2;
//       node2 = node2.parent;
//       temp.parent = root;
//     }
//   }
// }





// this is a port of something from libccv which
// is a port of something from opencv which is 
// a port of an algorithm in some textbook from
// somewhere

// it has rough functional parity with ccv_array_group
// and cvSeqPartition and the union-find algorithm
// except rather than returning a list of list 
// indicies in case one is so inclined to construct
// a list, it actually just returns the list

// this is a quadratic algorithm as far as I'm aware
// which means that the is_equal function will be called
// n(n - 1) times where n is the length of your elements
// array. For things with large numbers of elements,
// this can become very slow.

// it might be wise because of this to inform the
// algorithm with some notion of geometry. i.e.
// "these elements are really really far apart
// so they probably don't have anything to do with
// each other so lets just kind of let them do
// their thing and have incestuous relations with
// people closer to them"

function equivalence_classes(elements, is_equal){
  var node = []
  for(var i = 0; i < elements.length; i++){
    node.push({
      parent: 0,
      element: elements[i],
      rank: 0
    })
  }
  for(var i = 0; i < node.length; i++){
    var root = node[i]
    while(root.parent){
      root = root.parent;
    }
    for(var j = 0; j < node.length; j++){
      if(i == j) continue;
      if(!is_equal(node[i].element, node[j].element)) continue;
      var root2 = node[j];
      while(root2.parent){
        root2 = root2.parent;
      }
      if(root2 != root){
        if(root.rank > root2.rank){
          root2.parent = root;
        }else{
          root.parent = root2;
          if(root.rank == root2.rank){
            root2.rank++  
          }
          root = root2;
        }
        var node2 = node[j];
        while(node2.parent){
          var temp = node2;
          node2 = node2.parent;
          temp.parent = root;
        }
        var node2 = node[i];
        while(node2.parent){
          var temp = node2;
          node2 = node2.parent;
          temp.parent = root;
        }
      }
    }
  }
  var index = 0;
  var clusters = [];
  for(var i = 0; i < node.length; i++){
    var j = -1;
    var node1 = node[i]
    while(node1.parent){
      node1 = node1.parent
    }
    if(node1.rank >= 0){
      node1.rank = ~index++;
    }
    j = ~node1.rank;

    if(clusters[j]){
      clusters[j].push(elements[i])
    }else{
      clusters[j] = [elements[i]]
    }
  }
  return clusters;
}

// selection is i guess a singleton because otherwise it's
// a little confusing when you can select text from more than
// one picture on a single page, especially when it doesn't
// quite jive with the fact that normal selections are kinda
// not multi-selections.

var sel = {
	img: null,
	stack: [],
	start: null,
	end: null,
	deselect_time: 0
}

// onselectionchange is only supported on chrome and restricting
// the app to the other way of detecting prevents browser dependent
// selection detection bugs from arising

// document.addEventListener('selectionchange', change_select)
window.addEventListener('resize', handle_resize)


function collect_contexts(){
	for(var i in images){
		var image = images[i];
		if(image.el && image.el.getBoundingClientRect){
			var dim = image.el.getBoundingClientRect()
			if(dim.width == 0 || dim.height == 0){
				dispose_overlay(image.el)
				delete images[get_id(image.el)]
			}
		}
		if(image.overlay && image.overlay.childNodes.length == 0){
			dispose_overlay(image.el)
		}
	}
	var container = get_container();
	if(container.childNodes.length == 0){
		if(container.parentNode){
			container.parentNode.removeChild(container)
		}
	}
}


function handle_resize(e){
	if(sel.img){
		var image = im(sel.img);
		update_selection()
	}

	collect_contexts()

	for(var id in images){
		update_overlay(images[id].el);
	}
}

// document.addEventListener('paste', function(e){
// 	console.log('paste', e.clipboardData.getData('text'))
// 	console.log('cmd', document.execCommand('copy'));
// })

document.addEventListener('copy', function(e){
	// if(check_selection()) modify_clipboard();
	// get_selection(sel, images[sel.img.src]).length
	if(sel.start || sel.stack.length){
		// TODO: better check for whether or not we have a thing
		modify_clipboard()

		// here we should kick off the whole
		// background page clipboard monitoring
		// thing so that when someone copies
		// something while it isn't yet OCR'd
		// it'll be all aight as long as it's 
		// before the thing is done

		var image = im(sel.img);
		var block = extract_selection(sel, image);

		if(block.incomplete > 0){
			broadcast({
				type: 'clipwatch',
				id: image.id
			})
		}

		if(/\.(jpe?g|png|gif)$/i.test(location.pathname)){
			// this is a weird chrome thing
			// where you cant copy anything from
			// an image except like raw text
			
			setTimeout(function(){
				broadcast({
					type: 'copy',
					id: image.id,
					text: block.text
				})
			}, 10)
		}

		setTimeout(function(){
			// check if not tesseract
			var image = im(sel.img)
			selected_regions().forEach(function(region){
				var ocr = image.ocr[region.id];
				if(ocr._engine == 'ocrad'){
					// walp shitty local ocr
					// error_message(image, region, 'walp you have a shitty ocr engine')
				}
				// if(!(ocr && ocr._engine)) return;
			})

		}, 10)
	}
})


var text_layer;
function modify_clipboard(){
	if(!text_layer){
		text_layer = document.createElement('pre')
	}

	text_layer.className = 'project_naptha_text_layer'
	text_layer.innerHTML = ''
	
	text_layer.style.top = text_layer.style.left = '-100px'
	text_layer.style.width = text_layer.style.height = '10px'
	text_layer.style.overflow = 'hidden'
	text_layer.style.position = 'absolute'

	// for some reason, when you copy from something
	// which is an element outside of the document body
	// then it strips out all the newlines

	document.body.appendChild(text_layer)

	var range = document.createRange();
	var text = '<error extracting text ' +(new Date)+ '>'
	
	if(sel.img){
		var image = im(sel.img);
		text = extract_selection(sel, image).text
	}
	if(text){
		text_layer.textContent = text;
		text_layer.focus();

		range.selectNodeContents(text_layer)
		var selection = window.getSelection()
		selection.removeAllRanges();
		selection.addRange(range);
	}else{
		remove_textlayer()
	}
}



function push_sel(start, end){ sel.stack.push([start, end, Date.now()]) }



function clear_selection(){
	// console.trace()
	if(sel.img)
		render_selection(sel.img, [], {});
	sel.stack = [];

	// sel.img = new_img;
	// modify_clipboard()
}

function change_select(){
	if(!check_selection()){
		clear_selection();
		setTimeout(remove_textlayer, 0)
	}
}


function remove_textlayer(){
	if(text_layer){
		if(text_layer.parentNode)
			text_layer.parentNode.removeChild(text_layer);
	}
}
function check_selection(){
	var selection = window.getSelection();
	return (selection.rangeCount == 1 && (selection.anchorNode.parentNode == text_layer || selection.anchorNode == text_layer))
}


function do_lookup(image){
	image.lookup = {
		loading: Date.now()
	}

	var xhr = new XMLHttpRequest();
	xhr.open('GET', image.params.apiroot + 'lookup?url=' + encodeURIComponent(image.src))
	xhr.send()
	xhr.onerror = function(){
		image.lookup = {
			error: true
		}	
	}
	xhr.onload = function(){
		image.lookup = JSON.parse(xhr.responseText)
		image.lookup.finished = Date.now()
		// console.log('finished with lookup', image.lookup)
	}
}


function update_selection(){
	if(!sel || !sel.img) return;

	var image = im(sel.img)
	var selection = get_selection(sel, image);

	if(!image.lookup && navigator.onLine && !session_params.no_lookup){ // try again later if you're online
		do_lookup(image)
	}

	render_selection(sel.img, selection, image.params)
	

	if(selection.length > 0){
		selection.forEach(function(pair){
			var col = (pair[0] && pair[0].region) || pair[1].region;
			ocr_region(image, col)
		})	
	}else if(sel.start){
		var col = get_cursor(sel.start).region;
		
		ocr_region(image, col)
	}
	
}


// there's a shortcut syntax where you omit various parts of the cursor
// and then it magically figures it all out for you because it's like really
// clever and shit, but it's kind of a pain in the ass to make sure that
// everything works for the edge cases that this syntax creates
function fix_squig(start, end){
	var col = (start && start.region) || end.region;
	if(!start || !start.letter)
		start = { letter: { x0: col.x0 }, line: col.lines[0], region: col };
	if(!end || !end.letter)
		end = { letter: { x1: col.x1 }, line: col.lines[col.lines.length - 1], region: col };
	return [start, end, col]
}

// every squig can be decomposed into either a single rectangle or a combination
// of three rectangles (two adjacent lines is a case which is dealt with by creating
// a zero-or-negative height middle rectangle which gets immediately removed by a 
// simple arithmetic sanity check filter)

function rectify_squig(start, end){
	var _ = fix_squig(start, end),
		start = _[0],
		end = _[1],
		col = _[2];

	function sanity_check(box){ return box.x1 > box.x0 && box.y1 > box.y0 }

	if(start.line && start.line == end.line){
		return [ { x0: start.letter.x0, y0: start.line.y0, x1: end.letter.x1, y1: start.line.y1 } ].filter(sanity_check)
	}else{
		return [
			{ x0: start.letter.x0, y0: start.line.y0, x1: col.x1, y1: start.line.y1 },
			{ x0: col.x0, y0: start.line.y1, x1: col.x1, y1: end.line.y0 },
			{ x0: col.x0, y0: end.line.y0, x1: end.letter.x1, y1: end.line.y1 }
		].filter(sanity_check)
	}
}

function box_intersect(a, b){
	var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
		height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
	return (width > 0 && height > 0) ? width * height : 0;
}

function selected_regions(){
	var image = im(sel.img);
	return get_selection(sel, image).map(function(pair){
		var col = (pair[0] && pair[0].region) || pair[1].region;
		return image.regions.filter(function(region){
			return region.id == col.id;
		})[0]
	});
}


// I'm reasonably sure that the secret to writing good code is just rewriting early and often
// I think things generally get better each time you do it.

function get_selection(sel, image){

	var squigs = sel.stack.map(function(e){
		// here we need to clone everything to make sure
		// that our changes don't change the selection stack
		// for like reals

		var start = e[0],
			end = e[1];

		// also if things are bass-ackwards then we should
		// switch dem so they's proper and shit
		if(start && end){
			if(start.line == end.line){
				if(end.letter.x1 < start.letter.x0){
					return [end, start]
				}
			}else if(end.line.y1 < start.line.y0){
				return [end, start]
			}
		}

		// return things because errythin's a'ight
		return [start, end]
	}).concat(current_selection(sel, image)).filter(function(sel){
		var start = sel[0], end = sel[1]
		var sel_col = (start && start.region) || end.region;
		var regions = virtualize_region(image, image.regions)
		// check to make sure that everything in the selection exists
		var col_exists = regions.some(function(col){
			return sel_col == col
		})
		if(!col_exists && sel_col){
			// find closest matching analagous regions, usually
			// a superset, and use that as the parent region
			// there may be pathological cases with the layout
			// which really screw this thing up, but in general
			// this should provide for a better user experience
			// when dealing with regions that may expand
			var col_can = regions.map(function(col){
				return [box_intersect(sel_col, col), col]
			}).filter(function(n){
				return n[0] > 0
			}).sort(function(a, b){
				return b[0] - a[0]
			}).map(function(n){
				return n[1]
			});
			if(col_can.length){
				// var candidate = col_can[0] && (col_can[0].virtual || col_can[0]);
				var candidate = col_can[0]
				if(start && start.region) start.region = candidate;
				if(end && end.region) end.region = candidate;
				return true
			}
			// console.log(start, end, candidates)
		}
		// TODO: upgrade regions to analagous extant regions
		return col_exists
	});

	// what is this algorithm? O(n^4) whatever
	// actually it's probably still just O(n^2)
	// in spite of all this nesting because the
	// a_rects and b_rects comparison is probably
	// on average constant complexity because
	// it's either 1 or 3, i.e. O(n^2 * m) where
	// 1 <= m <= 9

	function cursor_adjacent(a, b){
		if(a.line != b.line) return false;
		var line = a.line;

		var lax = -1, lbx = -1;
		var wax = -1, wbx = -1;
		line.words.forEach(function(word, wi){
			if(word == a.letter) wax = wi;
			if(word == b.letter) wbx = wi;
			word.letters.forEach(function(letter, li){
				if(letter == a.letter) lax = li;
				if(letter == b.letter) lbx = li;
			})
		})
		if(lax != -1 && lbx != -1){
			return (Math.abs(lbx - lax) == 1)
		}
		if(wax != -1 && wbx != -1){
			return (Math.abs(wbx - wax) == 1)
		}
		return false
	}

	var merged = equivalence_classes(squigs, function(a, b){
		var a_col = (a[0] && a[0].region) || a[1].region;
		var b_col = (b[0] && b[0].region) || b[1].region;
		// if two squigs arent of the same region, then they cant
		// possibly be considered intersecting because otherwise the 
		// entire world would implode or something
		if(a_col != b_col) return false;
		// decompose each selection range into a squig, which is either
		// a single rectangle or a combination of three
		var a_rects = rectify_squig(a[0], a[1]);
		var b_rects = rectify_squig(b[0], b[1]);
		
		// perhaps there should be a squig adjacency detector
		// because maybe we should merge adjacent selections,
		// i.e. things that start immediately after another starts
		// note that this isn't something that sublime text appears
		// to do but of course the paradigm for editing is different
		// from selecting.



		var does_intersect = a_rects.some(function(a_rect){
			return b_rects.some(function(b_rect){
				return box_intersect(a_rect, b_rect)
			})
		});

		// if(!does_intersect){
		// 	var a_squig = fix_squig(a[0], a[1]),
		// 		b_squig = fix_squig(b[0], b[1])
		// 	var is_adj = cursor_adjacent(a_squig[0], b_squig[1]) || cursor_adjacent(a_squig[1], b_squig[0])
		// 	return is_adj
		// }

		return does_intersect
	})

	// so now we have a list of selection regions which happen
	// to at least slightly intersect with each other, now we just
	// iterate through each of these groups and determine the true
	// bounding box of these by sorting them first by vertically by line
	// and then horizontally by letter bounds

	return merged.map(function(ranges){
		if(ranges.length == 1) return ranges[0];
		
		// using a sort to pick out the first element is kinda handy
		// but it's O(n log n) rather than the achievable O(n) but
		// doing it this way is cleaner. Perhaps there should be an
		// Array::first(fn) which functions identically to 
		// Array::sort(fn)[0] but operates in O(n) time.

		var sorted_starts = ranges.map(function(e){
			// return e[0] // starts
			return fix_squig(e[0], e[1])[0] // starts
		}).sort(function(a_start, b_start){
			if(a_start.line.y0 < b_start.line.y0){
				return -1
			}else if(a_start.line.y0 == b_start.line.y0){
				if(a_start.letter.x0 < b_start.letter.x0){
					return -1
				}
			}
			return 1
		})

		var sorted_ends = ranges.map(function(e){
			// return e[1] // ends
			return fix_squig(e[0], e[1])[1] // ends
		}).sort(function(a_start, b_start){
			if(a_start.line.y1 > b_start.line.y1){
				return -1
			}else if(a_start.line.y1 == b_start.line.y1){
				if(a_start.letter.x1 > b_start.letter.x1){
					return -1
				}
			}
			return 1
		})


		return [sorted_starts[0], sorted_ends[0]]
	})
}

// this is the squig which results from pixel range of the selection
// that is, it deals with a start and end which aren't the kind of abstract
// high level entities which get_selection and render_selection deal with,
// but rather x and y coordinates.

function current_selection(sel, image){
	if(!image) return [];

	var params = image.params;

	var start = sel.start && get_cursor(sel.start)
	var end = sel.end && get_cursor(sel.end)
	
	if(!start || !end) return [];

	function swap(){var t = start; start = end; end = t; }

	var selection = [];
	var now = Date.now()

	var regions = virtualize_region(image, image.regions)


	if(start.region == end.region && start.line && end.line){
		if(start.line == end.line){
			// if(sel.start.X > sel.end.X) swap();
			if(start.letter.x0 >= end.letter.x1) swap();
		}else{
			if(sel.start.Y > sel.end.Y) swap();
		}
		// return [[start, end]]
		selection.push([start, end, now])
	}else if((!start.region || !end.region) || start.region != end.region){
		if(end.region && start.region){
			// if(start.region.y0 > end.region.y1 || start.region.x0 > end.region.x1){
			// 	swap();	
			// }

			if(start.region.x0 > end.region.x1){
				swap()
			}

			if(start.region.y0 > end.region.y1){
				swap();	
			}
		}else if(sel.start.Y > sel.end.Y){
			swap()
		}

		// intersect the set of all regions and the rectangle bounding the selection
		// sort such that the first element is the region which the selection
		// start lies on and the last element is the region which the selection
		// end lies on
		// perhaps make this a complex sorting routine that involves merging
		// things with equivalence_classes into real regions rather than 
		// whatever misnomer regions here are (since they actually represent
		// paragraphs) and then do a hierarchical kind of sort which goes
		// top to bottom and left to right
		// render all the intermediate regions as fully selected 
		// console.error("algorithm can't handle intraregion selection yet")
		
		var intersector = {
			x0: Math.min(sel.start.X, sel.end.X) * params.scale - 1,
			x1: Math.max(sel.start.X, sel.end.X) * params.scale + 1,
			y0: Math.min(sel.start.Y, sel.end.Y) * params.scale - 1,
			y1: Math.max(sel.start.Y, sel.end.Y) * params.scale + 1,
		}
		// var path = image.regions.filter(function(region){
		// 	var width = Math.min(intersector.x1, region.x1) - Math.max(intersector.x0, region.x0),
		// 		height = Math.min(intersector.y1, region.y1) - Math.max(intersector.y0, region.y0);
		// 	return width > 0 && height > 0
		// })

		var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
		regions.forEach(function(region){
			var width = Math.min(intersector.x1, region.x1) - Math.max(intersector.x0, region.x0),
				height = Math.min(intersector.y1, region.y1) - Math.max(intersector.y0, region.y0);
			if(width > 0 && height > 0){
				x0 = Math.min(x0, region.x0)
				y0 = Math.min(y0, region.y0)
				x1 = Math.max(x1, region.x1)
				y1 = Math.max(y1, region.y1)
			}
		})

		var path = regions.filter(function(region){
			var width = Math.min(x1, region.x1) - Math.max(x0, region.x0),
				height = Math.min(y1, region.y1) - Math.max(y0, region.y0);
			return width > 0 && height > 0
		})

		path.forEach(function(region){
			if(region == start.region){
				selection.push([start, null, now])
			}else if(region == end.region){
				selection.push([null, end, now])
			}else{
				selection.push([{region: region}, null, now])
			}
		})

		// console.log(selection)
	}
	// console.log(selection[0])
	return selection;
}


// TODO: replace this with something that renders to SVG
// because that's better, right?

function render_selection(img, selection, params){
	// var paper = img.naptha_highlight_canvas;
	var image = im(img)

	if(selection.length == 0){

		layer_clear(img, 'highlight')
		if(image.flame){
			image.flame.stopEmit = true;
		}
		return
	}



	// unfinished selected columns should be finished asap
	var chunks = [];
	selection.forEach(function(pair){
		var col = (pair[0] && pair[0].region) || pair[1].region;
		if(col.finished) return; // if its finished its ok
		
		[].concat(
			to_chunks(col.y0, image),
			to_chunks(col.y1, image),
			to_chunks(col.y0 - image.params.chunk_size, image),
			to_chunks(col.y1 + image.params.chunk_size, image)
		).forEach(function(chunk){
			if(chunks.indexOf(chunk) == -1 && 
				image.chunks.indexOf(chunk) == -1) 
					chunks.push(chunk);
		})
	})
	if(chunks.length > 0){
		// console.log('unfinished queueing', chunks)
		broadcast({
			type: 'qchunk',
			id: image.id,
			time: Date.now(),
			chunks: chunks
		})
	}


	// if(!end.region) return;

	var r = 2; // this is the arc radius for the squigs
	var lastX, lastY, _ = {}, stack = [];
	// all draw ops are stuck into a stack rather than drawing directly 
	// onto some canvas context because we want to process these ops and
	// calculate the minimum bounding box that we can make the canvas
	function setRotation(angle, x, y){ stack.push(['setrot', [angle, x, y]]) }
	function closePath(){ stack.push(['closePath']) }
	function setFill(color){ stack.push(['setfill', [color]]) }
	function setStroke(color){ stack.push(['setstroke', [color]]) }
	function moveTo(x, y){ stack.push(['moveTo', [lastX = x, lastY = y]]) }
	function scale(x, y){ stack.push(['scale', [x, y]]) }
	function setLineDash(dash){ stack.push(['dash', dash])}
	function arcTo(x, y){
		stack.push(['arcTo', [lastX, lastY, // we actually lag behind by one every time
								  lastX = (x == _ ? lastX : x), lastY = (y == _ ? lastY : y), // underscore to reuse
								  r]]) // plunk the radius onto there (TODO: retina scaling?)
	}
	
	// in case you didn't know or guess, this is what a squig looks like
	//
	//                     /----------------\
	//                     |                |
	//    /----------------/                | 
	//    |                                 |
	//    |                                 |
	//    |            /--------------------/
	//    |            |
	//    \------------/
	// 
	
	function selectionSquig(start, end){
		// make some dummy cursors if either is null
		var region = (start && start.region) || end.region;
		

		if(!start || !start.letter){
			start = {
				region: region,
				letter: { x0: region.x0 },
				line: region.lines[0]
			}
		}
		if(!end || !end.letter){
			end = {
				region: region,
				letter: { x1: region.x1 },
				line: region.lines[region.lines.length - 1]
			}
		}


		var xpad = 1, ypad = 3;


		if(start.line != end.line){
			// if the top of the line on the bottom is higher than the bottom of the line on the top
			// this is meant to deal with tightly adjacent lines
			if((end.line.cy - end.line.lineheight / 2 - ypad) - (start.line.cy + start.line.lineheight / 2 + ypad) < 1){
				// and the end of the bottom is left of the top
				if(end.letter.x1 <= start.letter.x0){
					// selectionSquig(start, { line: start.line, letter: { x1: start.line.x1 }})
					// selectionSquig({ line: end.line, letter: { x0: end.line.x0 }}, end)
					selectionSquig(start, { line: start.line, letter: { x1: region.x1 }})
					selectionSquig({ line: end.line, letter: { x0: region.x0 }}, end)
					return;	
				}
				// if(Math.abs(end.line.y0 - start.line.y0) < 2 && 
				// 	Math.abs(end.line.x0 - start.line.x0) < 2 && 
				if(end.line.x0 >= start.line.x1){
					selectionSquig(start, { line: start.line, letter: { x1: start.line.x1 }})
					selectionSquig({ line: end.line, letter: { x0: end.line.x0 }}, end)
					return;
				}
				
			}
		}

		var angle = region.angle;
		// if(Math.abs(angle) < 0.01) angle = 0;

		// two pixels
		if(Math.abs(angle * region.width / params.scale) < 2) angle = 0;

		setRotation(angle, region.cx, region.cy)

		// scale(1 / Math.cos(region.angle), 1)

		scale(1 / Math.cos(region.angle), 1 / Math.cos(region.angle))

		if(session_params.flame_on){
			setFill('rgba(255, 255, 0, 0.1)')
		}else{
			if(region.virtual){
				setFill('rgba(0, 173, 255, 0.3)') // light blue-green
			}else{
				setFill('rgba(0,100,255,0.4)')	// blue	
			}
			

			if(region.finished){
				setLineDash([])
			}else{
				setLineDash([4,4])
			}

			
			// setFill('rgba(0,100,255,0.1)')	// blue
			// var frac = (Math.sin((Date.now() % 2000) / 2000 * 2 * Math.PI) + 1) / 2;
			
			// function i(a, b){ return Math.round((b - a) * frac + a); }
			// var str = 'rgba(' + [
			// 	// 0,
			// 	// i(100, 231),
			// 	// i(255, 139),
			// 	// i(0, 255), 
			// 	// i(100, 133), 
			// 	// i(255, 0),

			// 	i(50, 0),
			// 	i(100, 163),
			// 	i(255, 240),

			// 	0.4
			// ].join(',') +')';
			
			// var str = 'hsla(' + [i(200, 240), '100%', '50%', 0.4].join(',') + ')'
			
			// console.log(str)
			// var opacity = frac * 0.2 + 0.3;
			// setFill(str)

			// setFill('rgba(0,100,255,' + opacity +')')	// blue


			// rgba(0, 69, 175, 0.4)
			// setFill('rgba(0, 231, 139, 0.4)') // green
		}
		
		// if(image.ocr && region.id in image.ocr && image.ocr[region.id].finished){
		// 	setStroke('rgba(255,0,0,0.8)')
		// }else 
		if(region.lines[0].direction == -1){
			setStroke('rgba(40,40,40,0.8)')
		}else{
			setStroke('rgba(211, 229, 255, 0.8)')
		}
		
		// moveTo(start.letter.x0 + r * 2, start.line.y0 - ypad)
		moveTo(start.letter.x0 + r * 2, start.line.cy - start.line.lineheight / 2 - ypad)
		

		if(start.line != end.line){
			arcTo(region.x1 + xpad, _)
			// arcTo(_, end.line.y0 - ypad)
			arcTo(_, end.line.cy - end.line.lineheight / 2 - ypad) // here
		}
		if(Math.abs(region.x1 - end.letter.x1) > 3 * r || start.line == end.line){
			arcTo(end.letter.x1 + xpad, _)	
		}
		
		// arcTo(_, end.line.y1 + ypad)
		arcTo(_, end.line.cy + end.line.lineheight / 2 + ypad)

		if(start.line != end.line){
			arcTo(region.x0 - xpad, _)
			// arcTo(_, start.line.y1 + ypad)	
			arcTo(_, start.line.cy + start.line.lineheight / 2 + ypad) //here
		}

		// if we're really close to the edge, just declare it a rounding error
		if(Math.abs(region.x0 - start.letter.x0) > 3 * r || start.line == end.line){
			arcTo(start.letter.x0 - xpad, _)
		}
		// arcTo(_, start.line.y0 - ypad)
		arcTo(_, start.line.cy - start.line.lineheight / 2 - ypad)
		
		if(start.line == end.line){
			arcTo(end.letter.x1 + xpad, _);
		}else{
			arcTo(region.x1 + xpad, _);
		}
		
		closePath()
		
	}
	
	selection.forEach(function(pair){ selectionSquig(pair[0], pair[1]) })

	var cx = 0, cy = 0, theta = 0;
	var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
	var ys_rot = 1, xs_rot = 1;
	// we need to calculate the bounding box of the selection squigs
	// and do some transformations so that it's aware of the rotations
	// and translations of random things.

	function trm(x, y){
		x -= cx; y -= cy; // translate
		var nx = ((x * Math.cos(theta) - y * Math.sin(theta))) * xs_rot + cx, // rotate & translate
			ny = ((x * Math.sin(theta) + y * Math.cos(theta))) * ys_rot + cy; // rotate & translate
		x0 = Math.min(x0, nx); y0 = Math.min(y0, ny);
		x1 = Math.max(x1, nx); y1 = Math.max(y1, ny);
	}

	stack.forEach(function(op){
		var args = op[1]; op = op[0];
		if(op == 'setrot'){
			cx = args[1]; cy = args[2];
			theta = args[0];
		}else if(op == 'moveTo'){
			trm(args[0], args[1])
		}else if(op == 'arcTo'){
			trm(args[0], args[1]);
			trm(args[2], args[3])
		}else if(op == 'scale'){
			xs_rot = args[0]; ys_rot = args[1]
		}
	})
 

	// this get slightly weird with non-integer device pixel ratio
	// todo: change x0, y0, x1, y1 so that width * dpr is always an int
	// TODO: also that thing with safari and its backingstore

	var dpr = window.devicePixelRatio;
	
	var ratio_x = img.width / img.naturalWidth / params.scale,
		ratio_y = img.height / img.naturalHeight / params.scale;

	// increase the margins because why not
	var margin = 5;
	x0 = Math.round(x0 * ratio_x - margin) ; y0 = Math.round(y0 * ratio_y - margin);
	x1 = Math.round(x1 * ratio_x + margin) ; y1 = Math.round(y1 * ratio_y + margin);

	// var layout = image_layout(img)
	var paper = layer(img, 'highlight', x0, y0)
	
	// document.body.appendChild(paper)
	var sfx = paper.getContext('2d');

	paper.width = Math.round((x1 - x0) * dpr)
	paper.height = Math.round((y1 - y0) * dpr) //sty('height') * window.devicePixelRatio
	paper.style.width = (x1 - x0) + 'px'
	paper.style.height = (y1 - y0) + 'px'
	

	
	sfx.translate(-dpr * x0, -dpr * y0)
	sfx.save()
	sfx.lineWidth = 1;
	sfx.beginPath()
	

	var cx = 0, cy = 0;
	var rx = ratio_x * dpr,
		ry = ratio_y * dpr;


	var ys_rot = 1, xs_rot = 1;

	stack.forEach(function(op){
		var args = op[1]; op = op[0];

		if(op == 'moveTo'){
			sfx.moveTo((rx * args[0] - cx) * xs_rot, (ry * args[1] - cy) * ys_rot)
		}else if(op == 'arcTo'){
			sfx.arcTo((rx * args[0] - cx) * xs_rot, (ry * args[1] - cy) * ys_rot, 
					  (rx * args[2] - cx) * xs_rot, (ry * args[3] - cy) * ys_rot, 
					  args[4] * dpr)
		}else if(op == 'closePath'){
			sfx.closePath()
			sfx.fill(); sfx.stroke()
			sfx.beginPath()
			sfx.restore(); sfx.save()
		}else if(op == 'setrot'){
			sfx.translate(cx = rx * args[1], 
						  cy = ry * args[2]);
			sfx.rotate(args[0])
		}else if(op == 'setfill'){
			sfx.fillStyle = args[0]
		}else if(op == 'setstroke'){
			sfx.strokeStyle = args[0]
		}else if(op == 'scale'){
			xs_rot = args[0]; ys_rot = args[1]
		}else if(op == 'dash'){
			if(sfx.setLineDash)
				sfx.setLineDash(args);
		}
	})

	if(window.CanvasFlame && session_params.flame_on){
		var flame_height = 90; // allow the flame to extend beyond the canvas

		// var flamecanvas = layer(img, 'pun', x0, y0 - flame_height)
		
		if(!image.flame){
			var flamecanvas = layer(img, 'pun', 0, -flame_height)
			flamecanvas.width = img.width
			flamecanvas.height = img.height + flame_height
			image.flame = new CanvasFlame(flamecanvas);
		}
		var flame = image.flame;

		// console.log(flame)
		// if(!paper.flame){
		// 	var canvas = document.createElement('canvas')
		// 	canvas.width = img.width
		// 	canvas.height = img.height + flame_height

		// 	paper.flame = new CanvasFlame(canvas);
		// 	document.body.appendChild(paper.flame.canvas)

		// 	paper.flame.canvas.style.position = 'absolute'
		// 	paper.flame.canvas.style.top = (layout.top - flame_height) + 'px'
		// 	paper.flame.canvas.style.left = layout.left + 'px'
		// 	paper.flame.canvas.style.userSelect = 'none'
		// 	paper.flame.canvas.style.pointerEvents = 'none'
		// 	paper.flame.canvas.className = 'project_naptha_meet_pun'
		// }
		// Math.round(img.naturalHeight * params.scale)

		flame.orig_context.clearRect(0, 0, flame.width, flame.height)
		flame.orig_context.drawImage(paper, x0, y0 + flame_height, x1 - x0, y1 - y0);
		flame.updateEmbers()
		flame.stopEmit = false;
		flame.start(-1)
	}
}

var lastClientX = 0, lastClientY = 0;
var lastPageX = 0, lastPageY = 0, lastPageT;
var meanDX = 0, meanDY = 0;
var lastPrediction = 0;


document.addEventListener('mousemove', track_mouse, true)
document.addEventListener('mousedown', begin_select, true)
document.addEventListener('mouseup', finish_select, true)
document.addEventListener('keydown', key_select, false)



document.addEventListener('click', function(e){
	if(Date.now() - sel.deselect_time < 100){
		e.preventDefault()
		e.stopPropagation()
		e.stopImmediatePropagation()
	}

	if(!valid_image(e.target)) return;
	
	var mouse = get_mouse(e); // update the cursor tracking yo
	if(!mouse.img) return; // well we cant do it if we cant find a pic

	var cursor = get_cursor(mouse);

	if(cursor.letter){
		e.preventDefault()
		e.stopPropagation()
		e.stopImmediatePropagation()
	}

}, true)


function begin_select(e){

	if(!menu_levels.some(function(menu){ return is_child(e.target, menu) })){
		// target is not in any menus
		create_menu([], 0)
	}

	// the context menu overlay stuff
	if(e.target.classList.contains('contextmenu_overlay')){
		e.preventDefault()
		return;
	}

	// this function is only for like when you're on an image
	if(!valid_image(e.target)){
		// this might be the beginning of a selection somewhere else
		// on the page, so we should like check if the selection 
		// changes because firefox doesn't support a selectionchange
		// event. also we only need to do this when the image
		// selection actually exists
		if(sel.start || sel.stack.length > 0){
			requestAnimationFrame(change_select);	
		}
		return;
	}

	var mouse = get_mouse(e); // update the cursor tracking yo
	if(!mouse.img) return; // well we cant do it if we cant find a pic
	if(e.button != 0) return; // must be a left click or whatever
	
	predict_mouse()

	var img = mouse.img;
	if(sel.img != img){
		clear_selection()
	}
	sel.img = img;

	var image = im(img);
	
	if(!image) return;


	// var sel = mouse.sel;

	update_pointer(mouse, image); // why not update the cursor 
	
	var cursor = get_cursor(mouse);

	
	// console.log('blah', cursor)

	if(e.detail == 1){ // number of clicks
		if(cursor.letter){
			if(!e.shiftKey) clear_selection();
			sel.start = mouse;
			sel.end = null;
			e.preventDefault()
			e.stopPropagation()
			e.stopImmediatePropagation()
		}else if(!e.shiftKey){
			clear_selection()
		}
	}else if(e.detail > 1){ // multiple clicks
		if(e.detail == 2 && cursor.word){
			if(!e.shiftKey) clear_selection();
			if(cursor.line.words.length == 1){
				push_sel(cursor, cursor) // cursor cursor on the wall, which is the shortest line of all?
			}else{
				push_sel(
					{region: cursor.region, line: cursor.line, letter: cursor.word.letters[0]},
					{region: cursor.region, line: cursor.line, letter: cursor.word.letters[cursor.word.letters.length - 1]}
				)
			}
		}else if(e.detail == 3 && cursor.region){
			if(!e.shiftKey) clear_selection();
			push_sel({ region: cursor.region })
		}else{
			if(e.detail == 10) session_params.flame_on = true;
			if(e.detail == 42) alert("Hi. My name is dug. I have just met you. I love you.");
		}
	}

	// sel.img = mouse.img
	update_selection()

	requestAnimationFrame(modify_clipboard)
}


function key_select(e){
	if(menu_levels.length){
		menu_keyhandle(e)
	}

	if(!sel.img) return;
	var image = im(sel.img);
	if(sel.stack.length == 0) return;

	var end = sel.stack[sel.stack.length - 1][1]
	
	function get_letters(line){ return [].concat.apply([], line.words.map(function(e){ return e.letters })) }

	if(e.keyIdentifier == 'Down' && e.shiftKey){
		// console.log('\\/')
		
		var index = end.region.lines.indexOf(end.line)

		var line = end.region.lines[index + 1];
		if(line){
			end.line = line;
			end.letter = get_letters(line).sort(function(a, b){
				return Math.abs(a.x0 - end.letter.x0) - Math.abs(b.x0 - end.letter.x0)
			})[0]
		}
		e.preventDefault()
	}else if(e.keyIdentifier == 'Up' && e.shiftKey){
		// console.log('/\\')
		var end = sel.stack[sel.stack.length - 1][1]
		var index = end.region.lines.indexOf(end.line)

		var line = end.region.lines[index - 1];
		if(line){
			end.line = line;
			end.letter = get_letters(line).sort(function(a, b){
				return Math.abs(a.x0 - end.letter.x0) - Math.abs(b.x0 - end.letter.x0)
			})[0]
		}
		e.preventDefault()
	}else if(e.keyIdentifier == 'Right' && e.shiftKey){
		
		var end = sel.stack[sel.stack.length - 1][1]
		var eletters = get_letters(end.line);

		var index = eletters.indexOf(end.letter)
		if(index < eletters.length - 1 && eletters[index + 1]){
			end.letter = eletters[index + 1]
		}
		// console.log('->', end.letter, index, end.line.letters)
		e.preventDefault()
	}else if(e.keyIdentifier == 'Left' && e.shiftKey){
		var end = sel.stack[sel.stack.length - 1][1]
		var eletters = get_letters(end.line);
		var index = eletters.indexOf(end.letter)
		if(index > 0 && eletters[index - 1]){
			end.letter = eletters[index - 1]
		}
		// console.log('<-', end.letter, index, end.line.letters)
		e.preventDefault()
	}else if(String.fromCharCode(e.keyCode) == 'Z' && (e.ctrlKey || e.metaKey)){
		sel.stack.pop(); // get rid of most recent thing
		e.preventDefault()
	}else if(String.fromCharCode(e.keyCode) == 'A' && (e.ctrlKey || e.metaKey)){
		image.regions.forEach(function(col){
			push_sel({region: col})
		})
		e.preventDefault()
	}
	update_selection()
}

function finish_select(e){
	if(sel.start){
		var img = sel.img;
		var image = im(img);
		if(valid_image(e.target)){
			var mouse = get_mouse(e);
			update_pointer(mouse, image); // why not update the cursor 
		}

		sel.stack = sel.stack.concat(current_selection(sel, image))
		sel.start = null
		sel.deselect_time = Date.now()

		update_selection()
		requestAnimationFrame(modify_clipboard)

		// TODO: create a general API for queuing
		// certain actions such that a function
		// is only called once in a given
		// span of time
		setTimeout(collect_contexts, 100)

		e.preventDefault()
		e.stopPropagation()
		e.stopImmediatePropagation()

	}	
}



/*
	It's April 16, 2014. 

	It's been six months since I started this project.

	Just under two years after I first came up with the idea.

	It's weird to think of time as something that happens,
	to think of code as something that evolves. And it may
	be obvious to recognize that code is not organic, that
	it changes only in discrete steps as dictated by some
	intelligence's urging, but coupled with a faulty and
	mortal memory, its gradual slopes are indistinguishable
	from autonomy. 

	Hopefully, this project is going to launch soon. It 
	looks like there's actually a chance that this will
	be able to happen. 
	
	The proximity of its launch has kind of been my own little
	perpetual delusion. During the hackathon, I announced that
	it would be released in two weeks time. 

	When winter break rolled by, I had determined to finish
	and release before the end of the year 2013.

	This deadline rolled further way, to the end of January
	term, IAP as it is known. But like all the artificial
	dates set earlier, it too folded against the tides of
	procrastination. 

	I'll spare you February and March, but they too simply
	happened with a modicum of dread. This brings us to the
	present day, which hopefully will have the good luck to
	be spared from the fate of its predecessors. 

	After all, it is the gaseous vaporware that burns.

*/

function update_pointer(mouse, image){
	var img = mouse.img, 
		imgX = mouse.X, 
		imgY = mouse.Y;

	if(image && image.params){
		var params = image.params;
		var sX = imgX * params.scale,
			sY = imgY * params.scale;
		
		var linpad = 3;
		var regpad = 10;

		var vreg = virtualize_region(image, image.regions);
		
		// console.log(image, frac_text)
		// if it's a link, the frac text is big and the area is small, then
		// disable naptha so that you have somewhere to click


		var in_region = vreg.some(function(region){
			return (sX + regpad >= region.x0 && sX - regpad <= region.x1 &&
					sY + regpad >= region.y0 && sY - regpad <= region.y1);
		});
		var has_text = vreg.some(function(region){
			return region.lines.some(function(line){
				return (sX + linpad >= line.x0 && sX - linpad <= line.x1 &&
						sY + linpad >= line.y0 && sY - linpad <= line.y1);
			})
		})
		
		if(has_text && mouse.inside){
			// img.style.cursor = 'text'
			// this is so it doesn't interfere
			img.setAttribute('naptha_cursor', 'text')
		}else if(in_region && mouse.inside){
			img.setAttribute('naptha_cursor', 'region')
		}else{
			img.removeAttribute('naptha_cursor')
			// img.style.cursor = ''
		}
		
	}
}


function track_mouse(e){
	var mouse = get_mouse(e)

	// DEBUG DEBUG DEBUG
	// var cursor = get_cursor(mouse)
	// if(cursor.letter){
	// 	// console.log(cursor.letter, cursor.dist)
	// 	console.log(cursor.line.lettersize, cursor.line.xheight, cursor.line.height, cursor.line.thickness, cursor.line.weight)
	// }
	

	var now = Date.now()

	if(now - lastPrediction > 100){
		// on occasion we should predict where the mouse is and
		// where it will be so that we can preemptively and
		// intelligently determine what exactly we'd like to 
		// process and in what order
		requestAnimationFrame(predict_mouse);
		lastPrediction = now;
	}

	// update the cursor if we find the current position
	if(mouse.img){
		var image = im(mouse.img);
		if(!image) return;
		
		update_pointer(mouse, image)		
		
		if(sel.start){
			sel.end = mouse;
		}
	}

	if(sel.start){
		e.preventDefault()
		e.stopPropagation()
		e.stopImmediatePropagation()
		// var image = im(sel.img)
		// var selection = get_selection(sel, image)
		// render_selection(sel.img, selection, image.params)
		update_selection()
		// console.log(selection)
		// selection.forEach(function(pair){
		// 	var col = (pair[0] && pair[0].region) || pair[1].region;
		// 	console.log(col)
		// 	// shitty_regions(pair[0], pair[1], image)
		// })

	}

	menu_handle(e)
}



function predict_mouse(){
	// here we extrapolate in order to find an image
	// and where on the image the cursor might land

	var minVel = 1; // pixels per millisecond
	var tMax = 500, tStep = 100;
	var curVel = Math.sqrt(meanDX * meanDX + meanDY * meanDY),
		velX = meanDX / curVel * Math.max(curVel, minVel),
		velY = meanDY / curVel * Math.max(curVel, minVel);
	
	// here's the core extrapolation process that coarsely locates candidate images
	var t = 0;
	do {
		var offsetX = lastClientX + velX * t
		var offsetY = lastClientY + velY * t
		if(offsetX < 0 || offsetY < 0 || offsetX >= innerWidth || offsetY >= innerHeight) break;
		el = document.elementFromPoint(offsetX, offsetY)
		t += tStep;
	} while ( el && t < tMax && !valid_image(el));
	
	if(!valid_image(el)){
		if(el) el.removeAttribute('naptha_cursor');
		return;
	}

	t -= tStep; // roll back the last thing

	var layout = image_layout(el);
	var relX = lastClientX - layout.X,
		relY = lastClientY - layout.Y;
	// var y_coords = [];
	var chunks = [];
	var image = im(el);
	var expires = Date.now() - 1000 * 10; // ten seconds is long enough right?

	do {
		var imgX = relX + meanDX / curVel * Math.max(curVel, minVel) * t,
			imgY = relY + meanDY / curVel * Math.max(curVel, minVel) * t;

		var natX = Math.max(0, Math.min(1, imgX / el.width)) * el.naturalWidth,
			natY = Math.max(0, Math.min(1, imgY / el.height) * el.naturalHeight);

		// y_coords.push(natY); // plop it on the end so that the list is sorted by distance from cursor
		// chunks = chunks.concat(to_chunks(natY, image))

		to_chunks(natY * image.params.scale, image).forEach(function(chunk){
			if(chunks.indexOf(chunk) == -1 && image.chunks.indexOf(chunk) == -1){
				chunks.push(chunk)
			}
		})
		
		t += tStep;
	} while ( t < tMax && imgX > 0 && imgY > 0 && imgX < el.width && imgY < el.height );

	// console.log('chu', chunks)
	// queue_chunks(el, y_coords)
	// queue_chunks(el, chunks)

	if(chunks.length > 0){
		var image = im(el)
		// console.log(chunks, image.chunks)
		
		// TODO: only send params when it's the first time
		// so that we can send less data less often

		// document.getElementById('project_naptha_core_frame').contentWindow.postMessage({
		// 	chunks: chunks,
		// 	time: Date.now(),
		// 	id: image.id,
		// 	params: image.params,
		// 	src: image.src
		// }, location.protocol + '//' + location.host)

		broadcast({
			type: 'qchunk',
			id: image.id,
			time: Date.now(),
			chunks: chunks
		})
	}

	// var cursor_set = document.querySelectorAll('[naptha_cursor]');
	// for(var i = 0; i < cursor_set.length; i++){
	// 	if(!valid_image(cursor_set[i])){
	// 		cursor_set[i].removeAttribute('naptha_cursor')
	// 	}
	// }
}



function get_mouse(e){
	lastClientX = e.clientX;
	lastClientY = e.clientY;

	// we continuously differentiate and dampen the derivative of the
	// motion of the cursor so that we can extrapolate into the future
	// and anticipate out which images are likely to be treaded upon later
	// for advance processing since the swt is a rather slow process

	var damp = 0.5,
		now = Date.now(),
		dt = now - lastPageT,
		dx = (e.pageX - lastPageX) / dt,
		dy = (e.pageY - lastPageY) / dt;
	
	if(dt != 0){
		lastPageX = e.pageX; lastPageY = e.pageY; lastPageT = now;
		meanDX = meanDX * damp + (1 - damp) * dx;
		meanDY = meanDY * damp + (1 - damp) * dy;
		if(!isFinite(meanDX) || !isFinite(meanDY)) meanDX = meanDY = 1;	
	}
	
	// var target = document.elementFromPoint(e.clientX, e.clientY);

	// check if the cursor is directly on top of some image which is
	// valid and searchable for text
	if(valid_image(e.target)){
		var img = e.target;
		var layout = image_layout(img)

		// transform the cursor into coordinates on the image
		// var imgX = Math.min(1, Math.max(0, (e.clientX - layout.X) / img.width)) * img.naturalWidth, 
		// 	imgY = Math.min(1, Math.max(0, (e.clientY - layout.Y) / img.height)) * img.naturalHeight;

		var fracX = (e.clientX - layout.X) / img.width, 
			fracY = (e.clientY - layout.Y) / img.height;


		// if(!img.naptha_sel){
		// 	img.naptha_sel = {
		// 		stack: [],
		// 		start: null,
		// 		end: null
		// 	}
		// }
		// var sel = img.naptha_sel;

		// okay, so we's already gots an image
		// now we do things like decide whether the cursor
		// should change and shit like that
		

		return {
			img: img, 
			sel: sel, 
			inside: (fracX > 0 && fracY > 0 && fracX < 1 && fracY < 1),
			X: fracX * img.naturalWidth, 
			Y: fracY * img.naturalHeight
		}	

		
	}
	return {}
}


// so I guess there's a chain of object transitions and transformations 
// first is the native dom events, in this case mousemove or mousedown
// which have element targets with associated locations on the page and
// clientX and clientY coordinates embedded within in them. the first
// stage of the transformation takes all that into account and also
// keeps track of the random derivative keeping and returns an object
// with the image and the set of transformed x and y coordinates in a
// natural coordinate system ranging from 0 to the width of the underlying
// image. then is the conversion into something called a cursor, which
// is a localization system in terms of regions, letters, lines and words.

// here's a little helper method
function point2rect(x, y, rect){
	// clamp (x, y) to edge of rectangle to find closest point that lies within rect
	var ex = Math.max(Math.min(x, rect.x1), rect.x0),
		ey = Math.max(Math.min(y, rect.y1), rect.y0);
	// euclidean distance from clamped to point (pythagorean theorem)
	return Math.sqrt((x - ex) * (x - ex) + (y - ey) * (y - ey))
}


function get_cursor(mouse){
	var img = mouse.img;
	var image = images[get_id(img)];
	// gotta make sure we have regions
	if(!image || !image.regions) return {};

	var params = image.params,
		sX = mouse.X * params.scale,
		sY = mouse.Y * params.scale;

	


	// UNTESTED I HAVE NO IDEA IF THIS WORKS
	// function point2rrect(x, y, rect){
	// 	// this is a generalization of the helper method that works
	// 	// when the rectangle is rotated and stuff
	// 	var xp = (x - rect.cx) * Math.cos(-rect.angle) - (y - rect.cy) * Math.sin(-rect.angle)
	// 	var yp = (x - rect.cx) * Math.sin(-rect.angle) + (y - rect.cy) * Math.cos(-rect.angle)

	// 	return point2rect(xp, yp, {
	// 		x0: -rect.width / 2,
	// 		x1:  rect.width / 2,
	// 		y0: -rect.height / 2,
	// 		y1:  rect.height / 2
	// 	})
	// }

	function search_region(col_sel){
		var line_sel = null, letter_sel = null, word_sel = null, min_dist = Infinity;
		// if region is defined, then all the other location parameters
		// are found by simply brute forcing all the elements inside 
		// and finding out which ones are closest
		// wow such loop. very nested. 
		for(var i = 0; i < col_sel.lines.length; i++){
			var line = col_sel.lines[i];
			for(var j = 0; j < line.words.length; j++){
				var word = line.words[j]
				for(var k = 0; k < word.letters.length; k++){
					var letter = word.letters[k], box = letter;
					// expand the effective region of the last letter to that of the entire
					// rest of the region
					if(i == col_sel.lines.length - 1 && 
						j == line.words.length - 1 &&
						k == word.letters.length - 1){
						box = { x0: letter.x0, y0: letter.y0, x1: col_sel.x1, y1: col_sel.y1}
					}
					// todo: the analagous thing for the first letter
					var box_width = box.x1 - box.x0;
					var d = point2rect(sX, sY, box);
					if(d < min_dist){
						min_dist = d;
						line_sel = line;
						word_sel = word;
						letter_sel = letter;
					}
				}
			}
		}
		return {
			line: line_sel,
			letter: letter_sel,
			word: word_sel,
			dist: min_dist,
			region: col_sel
		}
	}

	// you have to be within 10px (arbitrary parameter) of a region to be considered
	// part of that region - otherwise, function will return with null region
	if(image.regions){
		var regions = virtualize_region(image, image.regions)

		var region_candidates = regions.map(function(col){
			var col_dist = point2rect(sX, sY, col);
			if(col_dist > 10) return;

			var match = search_region(col)

			return match
		})
		.filter(function(e){ return e })
		.sort(function(a, b){ return a.dist - b.dist });

		var result = region_candidates[0];
	}

	if(result){
		if(result.line){
			var widths = [], wordlen = [];
			result.line.words.forEach(function(word){
				wordlen.push(word.letters.length);
				word.letters.forEach(function(letter){
					widths.push(letter.x1 - letter.x0)
				})
			});
			function S(a, b){ return a + b }
			var meanlen = wordlen.reduce(S) / wordlen.length;
			var mean = widths.reduce(S) / widths.length;
			var std = Math.sqrt(widths.map(function(e){ return (e - mean) * (e - mean) }).reduce(S) / widths.length)

			var max = Math.max.apply(Math, widths),
				min = Math.min.apply(Math, widths);
			// console.log(result.region.xheight)
			if(std > 10 && meanlen <= 3 && result.region.xheight < 40){
				// criterion for words that are kinda connected and therefore we should use
				// words instead of letters as the atomic selection size
				result.letter = result.word;
			}
		}
	}
	return (result || {})
}
// this is the code for managing layers
// because just about all the visual interface is presented
// in the form of a series of canvas elements positioned on
// top of a certain image. 

// these are different layers, like the selection boxes
// the optional flame overlay for the selection boxes,
// the inpainting mask, and the translated text

// there's also the pseudo-layer which manages clipboard
// interaction, but that's managed separately because it's
// not inhernetly element-bound or position-sensitive

// this means that we have to keep track of every image and
// the respective involved canvases, when the page is 
// transformed (i.e. resized), we have to invalidate the 
// positioning and reposition the canvases to be in their
// appropriate positions


function layer_clear(img, name){
	name = name || 'default';
	var image = im(img)
	if(!('layers' in image)) return;
	if(name == '*'){
		for(var n in image.layers)
			layer_clear(img, n);
		// console.log('cleared shit')
		return;
	}
	if(!(name in image.layers)) return;
	var paper = image.layers[name];
	if(paper.parentNode){
		paper.parentNode.removeChild(paper)
	}
	delete image.layers[name]
}

function get_container(){
	// make sure there's a container for all the naptha
	// related things
	var container_id = "project_naptha_container"
	var container = document.getElementById(container_id);

	if(!container){
		container = document.createElement('div')
		container.id = container_id
		// document.body.appendChild(container)

		// inject the element outside the body so that
		// most css doesn't affect it
		document.documentElement.appendChild(container)
	}

	return container
}

function dispose_overlay(img){
	var image = im(img)
	if(image.overlay && image.overlay.parentNode){
		image.overlay.parentNode.removeChild(image.overlay)
	}
	image.overlay = null
	delete image.overlay;

}

function update_overlay(img){
	var image = im(img)

	if(!('overlay' in image)){
		image.overlay = document.createElement('div')
		get_container().appendChild(image.overlay)
	}

	var overlay = image.overlay
	// lets position teh elment and stuff i guess

	var layout = image_layout(img)
	overlay.setAttribute('data-imageid', image.id)

	overlay.style.position = 'absolute'
	overlay.style.userSelect = 'none'
	overlay.style.pointerEvents = 'none'
	overlay.style.margin = '0'
	overlay.style.border = '0'
	overlay.style.padding = '0'
	overlay.style.opacity = '1'
	overlay.style.left = layout.left + 'px'
	overlay.style.top = layout.top + 'px'
	
}


function layer(img, name, x0, y0){
	name = name || 'default';
	x0 = x0 || 0;
	y0 = y0 || 0;

	var image = im(img)

	if(!('layers' in image))
		image.layers = {};
	
	// now actually access and create the element which
	// is the currentlayer
	if(!(name in image.layers)){
		var paper = image.layers[name] = document.createElement('canvas');
		
		update_overlay(img);

		image.overlay.appendChild(paper)
	}

	var paper = image.layers[name];
	paper.setAttribute('data-layername', "project_naptha_layer_"+name)
	paper.style.userSelect = 'none'
	paper.style.pointerEvents = 'none'
	paper.style.left = x0 + 'px'
	paper.style.top = y0 + 'px'

	init_layer(paper, name)

	return paper
}

function depth(name){
	var ordering = [
		'plaster',
		'translate',
		'debug',
		'highlight',
		'pun',
		'shimmer',
		'error',
		'overlay',
		'menu'
	];
	if(ordering.indexOf(name) == -1){
		console.warn("Error: ", name, "not found in ordering schema")
	}

	// it's a really big number but still smaller than the max z-index and its the unix timestamp
	// of a photo which was taken shortly after walking off the stage  where it was announced 
	// that I had won second place at HackMIT 2013
	

	// return 1381080740 + ordering.indexOf(name) * 14;
	// the max z-index is 2147483647

	// some tumblr lightbox had a higher z-index than that

	return 2147483645 - ordering.length + ordering.indexOf(name);

	// perhaps we should automatically enumerate all teh elmeents
	// and then lower their z-indexes so that we can fit
}


function init_layer(el, name){
	el.style.zIndex = depth(name);
	
	el.style.position = 'absolute'
	el.style.margin = '0'
	el.style.border = '0'
	el.style.padding = '0'
	// el.style.opacity = '1'
	el.style.boxShadow = 'none'
}


function error_message(image, region, text){
	var div = document.createElement('div')
	if(text){
		div.innerHTML = "<b>Error</b> "
		div.appendChild(document.createTextNode(text.replace(/^\s*Error:?\s*/i, '')))
	}else{
		div.innerHTML = "<b>Error</b> something went wrong"	
	}
	
	div.innerHTML += ' <button type="button" class="close" data-dismiss="alert" onclick="this.parentNode.parentNode.removeChild(this.parentNode)">&times;</button>'
	div.className = "alert-danger"
	div.style.zIndex = depth('error')
	update_overlay(image.el)

	var xpad = 10,
		ypad = 10;

	var sx = (image.el.width / image.el.naturalWidth / image.params.scale),
		sy = (image.el.height / image.el.naturalHeight / image.params.scale);

	var layout = image_layout(image.el)

	div.style.position = "absolute"
	div.style.left = (layout.left + sx * region.x0 + xpad) + 'px'
	div.style.top = (layout.top + sy * region.y0 + ypad) + 'px'

	div.style.width = Math.max(250, (sx * region.width - (35 + 14 + 1 + 1) - xpad * 2))  + 'px'
	// init_layer(div, 'error')
	// image.overlay.appendChild(div)

	get_container().appendChild(div)

}



function update_translations(image){
	if(!image.translate) image.translate = {};

	image.regions.forEach(function(region){
		if(!(region.id in image.translate)) return;

		var translate = image.translate[region.id];

		function finish_translation(){

			translate.processing = false
			translate.waiting = false;
			translate.finished = Date.now()

			translate_region(image, region)
			draw_overlays(image)
			update_selection()

		}

		if(!translate.language || translate.language == 'erase'){
			finish_translation()
		}else if(image.ocr && translate.waiting && region.id in image.ocr){
			var ocr = image.ocr[region.id]
			if(ocr.finished){

				var text = extract_region(ocr, { region: region })
					.join('\n').trim().replace(/\n/g, ' ').replace(/- +/g, '').trim();
				
				translate.waiting = false;
				translate.processing = Date.now()				

				if(translate.language == 'esrever'){
					translate.text = text.split('').reverse().join('')
					finish_translation()
				}else if(translate.language == 'echo'){
					translate.text = text;
					finish_translation()
				}else if(translate.language == 'pig'){
					translate.text = text.replace(/[a-z]+/ig, function(e){
						if(e.length < 3) return e;
						if(!/^[a-z]*$/i.test(e)) return e;
						var proc = /[aeiou]/i.test(e[0]) ? (e + 'way') : (e.slice(1) + e[0].toLowerCase() + 'ay');
						if(e[0] == e[0].toUpperCase()) proc = proc[0].toUpperCase() + proc.slice(1);
						if(e == e.toUpperCase()) proc = proc.toUpperCase();
						return proc
					})
					finish_translation()
				}else{
					var xhr = new XMLHttpRequest();
					xhr.open('POST', image.params.apiroot + 'translate')
					var formData = new FormData();
					
					var lang = translate.language;

					formData.append('target', lang)
					formData.append('url', image.src)
					formData.append('text', text)
					formData.append('user', global_params.user_id)
					xhr.send(formData)
					xhr.onerror = function(){
						// image.regions.forEach(function(region){
						// 	if(region.id == data.reg_id){
						// 		error_message(image, region, data.text)
						// 	}
						// })
						error_message(image, region, "The translation server could not be reached")
						delete image.translate[region.id]
						// finish_translation()
					}
					xhr.onload = function(){
						// image.lookup = JSON.parse(xhr.responseText)
						try {
							var json = JSON.parse(xhr.responseText);
						
							translate.text = json.text
							finish_translation()
						} catch (err){
							error_message(image, region, xhr.responseText)
							delete image.translate[region.id]
						}
						

						if(!((image.lookup || {}).translations || []).some(function(chunk){ return chunk.target == lang })){
							((image.lookup || {}).translations || []).push({
								target: lang
							})
						}


					}
				}
				
			}

		}

		if(!(region.id in image.plaster) && translate.language){
			queue_broadcast({
				src: image.src,
				type: 'qpaint',
				id: image.id,
				reg_id: region.id,
				region: region,
				swtscale: image.params.scale,
				swtwidth: image.width
			})

			image.plaster[region.id] = { processing: Date.now() }
			
			region.shimmer = Date.now();
		}

	})
}


function draw_overlays(image){
	setTimeout(function(){
		image.regions.forEach(function(region){
			var elapsed = get_elapsed(image, region)
			var plaster = image.plaster[region.id]
			var translate = image.translate[region.id] || {};
			
			if(elapsed > 0){ // && elapsed < 1000
				if(translate.language){
					
					if(plaster && plaster.mask)
						plaster.mask.style.opacity = 1;
					if(translate.language != 'erase'){
						if(translate && translate.paper)
							translate.paper.style.opacity = 1;
					}else{
						if(translate && translate.paper)
							translate.paper.style.opacity = 0;
					}
				}else{
					if(plaster && plaster.mask)
						plaster.mask.style.opacity = 0;
					
					if(translate && translate.paper)
						translate.paper.style.opacity = 0;	
				}

			}else{
				if(plaster && plaster.mask)
					plaster.mask.style.opacity = 0;
				if(translate && translate.paper)
					translate.paper.style.opacity = 0;
				// layer(image.el, 'translate', 0, 0).style.opacity = 0;
			}

		})
	}, 0)	
}


function translate_region(image, region){
	if(!image.ocr) return;
	if(!image.plaster) image.plaster = {};
	if(!image.virtual) image.virtual = {};
	if(!image.translate) image.translate = {};


	if(!(region.id in image.translate)) return;

	var translate = image.translate[region.id];

	if(!translate.paper){
		translate.paper = document.createElement('canvas')
		update_overlay(image.el)
		image.overlay.appendChild(translate.paper)

		translate.paper.style.transition = 'opacity 1s'
		translate.paper.style.opacity = '0'

	}

	var img = image.el
	
	var paper = translate.paper;

	init_layer(paper, 'translate')
	paper.style.left = '0px'
	paper.style.top = '0px'	
	paper.setAttribute('data-layername', "project_naptha_layer_translate")
	paper.width = img.naturalWidth
	paper.height = img.naturalHeight
	paper.style.width = img.width + 'px'
	paper.style.height = img.height + 'px'
	

	var ctx = paper.getContext('2d')
	if(!translate.language) return;

	if(translate.waiting || translate.processing) return;

	if(!(region.id in image.ocr)) return;
	var ocr = image.ocr[region.id];
	if(ocr.processing) return;

	if(translate.language == 'erase') return;

	var plaster = image.plaster[region.id];

	if(!plaster || plaster.processing) return;

	// this propagates positional information upwards

	function wrap(children, extend){
		extend = extend || {};
		extend.x0 = Infinity; extend.y0 = Infinity;
		extend.x1 = 0; extend.y1 = 0;
		children.forEach(function(child){
			extend.x0 = Math.min(extend.x0, child.x0); extend.y0 = Math.min(extend.y0, child.y0);
			extend.x1 = Math.max(extend.x1, child.x1); extend.y1 = Math.max(extend.y1, child.y1);
		})
		extend.cx = extend.x1 / 2 + extend.x0 / 2;
		extend.cy = extend.y1 / 2 + extend.y0 / 2;
		return extend;
	}

	function get_letters(region){
		return [].concat.apply([], region.lines.map(function letters_from_line(line){
			return [].concat.apply([], line.words.map(function(e){ return e.letters })) 
		}))
	}

	function html_decode_entities(text){
		var x = document.createElement('textarea')
		x.innerHTML = text;
		return x.value
	}
	var text = html_decode_entities(translate.text);


	// var text = ocr.text.replace(/\n/g, ' ').replace(/- +/g, '').trim();
	

	// function align_stats(prop){
	// 	var align_thresh = 0.1;
	// 	var met = region.lines.map(function(line){ return line[prop] })
	// 	var mean = met.reduce(function(a, b){ return a + b }) / region.lines.length;
	// 	return !met.some(function(line_dim){
	// 		return Math.abs(line_dim - mean) / region.width > align_thresh
	// 	})
	// }

	function align_mad(prop){ // mad props, dawg!
		var met = region.lines.map(function(line){ return line[prop] })
		var mean = met.reduce(function(a, b){ return a + b }) / region.lines.length;
		var mad = met
			.map(function(line_dim){ return Math.abs(line_dim - mean) / region.width })
			.sort(function(a, b){ return a - b })[Math.floor(region.lines.length / 2)]
			// .reduce(function(a, b){ return a + b }) / region.lines.length;
		return mad
	}


	var align = 'left'
	if((align_mad('cx') < align_mad('x0') && align_mad('cx') < align_mad('x1')) || region.lines.length == 1){
		// centered
		align = 'center'
	}else if(align_mad('x0') < align_mad('x1') && align_mad('x0') < align_mad('cx')){
		// left align
		align = 'left' 
	}else if(align_mad('x1') < align_mad('x0') && align_mad('x1') < align_mad('cx')){
		// right align
		align = 'right'
	}



	// var centered = align_stats('cx'),
	// 	right = align_stats('x1'),
	// 	left = align_stats('x0'),
	// 	justified = right && left;


	var letters = get_letters(region);
	var frac_up = letters.filter(function(e){ return e.height / region.xheight > 1.2 }).length / letters.length;
	// console.log(frac_up, region.xheight, letters.map(function(e){ return e.height }))
	if(frac_up < 0.05){
		// oh look its all uppercased text
		var font_size = Math.round(1.0 * region.xheight);
		text = text.toUpperCase()

	}else{
		// 1.7095x + 0.1124 where x is the normalized x-height
		// this was acquired by means of a linear regression
		// on some data
		var font_size = Math.round(1.7 * (region.xheight / image.params.scale) + 0.1124);	
	}

	
	
	// ctx.shadowColor = "#000"
	ctx.shadowBlur = 0;

	var font_weight = 400,
		font_name = '';

	if(frac_up < 0.05 && region.lettersize / region.xheight > 0.4){

		var rgb = plaster.colors[0][1]
		var luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];

		if(luma > 200){
			ctx.shadowColor = "#000"
			ctx.shadowBlur = 5;
		}

		if((region.lettersize / region.xheight) > 0.7){
			// ctx.font = ' ' + font_size + 'px Impact'
			font_name = 'Impact'
		}else{
			font_name = 'xkcd'
			// ctx.font = ' ' + font_size + 'px xkcd'	
		}

		
	}else{
		var font_weight_th = (38.85 * region.thickness - 33.65) / font_size
		var font_weight_ls = (13.97 * region.lettersize - 64.69) / font_size

		// var font_weight = Math.min(900, Math.max(100, Math.round(font_weight_th / 2 + font_weight_ls / 2) * 100))
		font_weight = Math.min(900, Math.max(100, Math.round(font_weight_th) * 100))
		// var font_weight = Math.min(900, Math.max(100, Math.round(font_weight_ls) * 100))
		// var font_weight = Math.min(900, Math.max(100, Math.round((region.lettersize / region.xheight) * 18.30 - 7.20) * 100))
		// var font_weight = Math.min(900, Math.max(100, Math.round((region.lettersize / region.xheight) * 16.63 - 4.37) * 100))

		// var font_weight = Math.min(900, Math.max(100, Math.round((region.thickness / region.xheight) * 17.29 - 8.59) * 100))
		// var font_weight = 'light';
		// console.log('font weight', font_weight)
		// ctx.font = font_weight + ' ' + font_size + 'px "Helvetica Neue"'
		font_name = '"Helvetica Neue"'
	}


	function measure(line){ return ctx.measureText(line).width }

	// TODO: something really intelligent, like looking into the letter layouts
	// to see if the raggedness is due to the presence of some object, rather than
	// the mere action of text wrapping, and have an intelligent line breaking
	// system which compensates for that

	
	
	while(true){
		ctx.font = font_weight + ' ' + font_size + 'px ' + font_name;
		
		var words = breakWords(text.split(' '), measure, region.width / image.params.scale);

		if(region.lines.length == 1){
			var textlines = [words.join(' ')]
		}else{
			var textlines = breakLineGreedy(words, measure, region.width / image.params.scale)	
		}
		
		var min_height = textlines.length * font_size * image.params.scale;
		if(min_height > region.height && textlines.length > 1){
			// console.log("KLDFJSOIDFJSOIDJFOISJDFOISJDF WALP WALP WLAP", font_size)
			font_size--
			continue;
		}
		var max_width = Math.max.apply(Math, textlines.map(measure))

		if(max_width > region.width / image.params.scale){
			font_size--
			continue;
		}
		break;
	}

	console.log(textlines.join('\n')) 
	ctx.save()
	
	var ox = region.cx / image.params.scale, 
		oy = region.cy / image.params.scale;
	
	ctx.translate(ox, oy)
	ctx.rotate(region.angle)


	var lines = textlines.map(function(line, index){
		if(!line) return;
		
		if(plaster.colors && plaster.colors[0] && plaster.colors[0][1]){
			var rgb = plaster.colors[0][1]
			// var luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
			// if(luma < 30){
			// 	rgb = [0, 0, 0]
			// }else if(luma > 230){
			// 	rgb = [255, 255, 255]
			// }
			// ctx.fillStyle = 'rgb(' + ocr.colors[0][1].map(Math.round).join(',') + ')'	
			ctx.fillStyle = 'rgb(' + rgb.map(Math.round).join(',') + ')'
			
		}
		var vpad = 5; 
		var region_height = (region.lines[region.lines.length - 1].cy + region.lines[region.lines.length - 1].lineheight / 2) - (region.lines[0].cy - region.lines[0].lineheight / 2)
		var cy = (region.cy - region_height / 2 - vpad + (region_height + vpad * 2) * ((0.5 + index) / textlines.length));
		

		ctx.textBaseline = 'middle';
		if(align == 'center'){
			ctx.textAlign = 'center'
			ctx.fillText(line, region.cx / image.params.scale - ox, cy / image.params.scale - oy)
		}else if(align == 'left'){
			ctx.textAlign = 'left'
			ctx.fillText(line, region.x0 / image.params.scale - ox, cy / image.params.scale - oy)
		}else if(align == 'right'){
			ctx.textAlign = 'right'
			ctx.fillText(line, region.x1 / image.params.scale - ox, cy / image.params.scale - oy)
		}
		// ctx.strokeRect(region.cx / image.params.scale - ox, cy / image.params.scale - oy, 10, 10)
		
		var letters = [];

		var h  = font_size * image.params.scale;
		
		// ctx.strokeRect(region.x0 / image.params.scale, cy / image.params.scale, measure(line), h / image.params.scale)

		for(var i = 0; i < line.length; i++){
			var w  = measure(line[i]) * image.params.scale;
			if(align == 'center'){
				var x0 = region.x0 + (region.width - measure(line) * image.params.scale) / 2 + measure(line.slice(0, i)) * image.params.scale
			}else if(align == 'left'){
				var x0 = region.x0 + measure(line.slice(0, i)) * image.params.scale
			}else if(align == 'right'){
				var x0 = region.x1 - measure(line.slice(i)) * image.params.scale

			}
			letters.push({
				x0: x0, x1: x0 + w,
				y0: cy - h / 2, y1: cy + h / 2,
				_: line[i]
			})
		}
		var words = [], buf = [];
		for(var i = 0; i < letters.length; i++){
			if(letters[i]._ == ' '){
				words.push(buf)
				buf = []
			}else buf.push(letters[i]);
		}
		words.push(buf)
		return wrap(letters, {
			lineheight: h,
			id: 'VLINE_' + index,
			direction: region.direction,
			words: words.filter(function(e){
				return e.length
			}).map(function(letters){
				return wrap(letters, {
					letters: letters
				})
			})
		})
	});
	

	ctx.restore()
	// console.log('region angle', region.angle, region.id)

	image.virtual[region.id] = wrap(lines, {
		id: region.id,
		lines: lines,
		angle: region.angle,
		finished: true,
		virtual: true,
		direction: region.direction
	})
		
}

function breakWord(word, measure, L){
	var i = 0, j = 0, words = [];
	while(j < word.length){
		var j = i + 1;
		while(j <= word.length && measure(word.slice(i, j + 1)) < L){

			j++;
		}
		words.push(word.slice(i, j))
		i = j;
	}
	return words;
}

function breakWords(words, measure, L){
	return [].concat.apply([], words.map(function(word){
		return breakWord(word, measure, L)
	}));
}

function breakLineGreedy(words, measure, L){

	var i = 0, j = 0, lines = [];
	while(j < words.length){
		var j = i + 1;
		while(j <= words.length && measure(words.slice(i, j + 1).join(' ')) < L){
			j++;
		}
		lines.push(words.slice(i, j).join(' '))
		i = j;
	}
	return lines;
}


// http://stackoverflow.com/questions/18200593/implementing-text-justification-with-dynamic-programming

function breakLineDP(words, measure, L){
	var wl = words.map(measure),
		space = measure('m');

	var n = wl.length;
	var m = { '0': 0 }; // total "badness"
	var s = { }; // aux array

	function length(wordLengths, i, j){
		var arr = wordLengths.slice(i - 1, j)
		var sum = arr.length == 0 ? 0 : 
			arr.reduce(function(a, b){ return a + b });
		return sum + j - i + space
	}

	for(var i = 1; i < n + 1; i++){
		var sums = {};
		var k = i;
		while(length(wl, k, i) <= L && k > 0){
			sums[Math.pow(L - length(wl, k, i), 3) + m[k - 1]] = k
			k--;
		}
		m[i] = Math.min.apply(Math, Object.keys(sums))
		s[i] = sums[m[i]]
	}
	var line = 1, lines = [];

	while(n > 0){
		lines.unshift(words.slice(s[n] - 1, n).join(' '))
		n = s[n] - 1
		line++
	}
	return lines
}


function draw_annotations(img, image){
	var params = session_params;
	if(!((params.show_contours || params.show_letters || params.show_lines || params.show_regions || params.show_chunks || params.show_stitching) && image)){
		layer_clear(img, 'debug')
		return;
	}

	var layout = image_layout(img);

	var paper = layer(img, 'debug', 0, 0)
	paper.width = image.width
	paper.height = image.height
	paper.style.width = img.width + 'px'
	paper.style.height = img.height + 'px'
	
	var ctx = paper.getContext('2d')

	var num_chunks = Math.max(1, Math.ceil((image.height - image.params.chunk_overlap) / (image.params.chunk_size - image.params.chunk_overlap)))
	
	image.chunks.forEach(function(chunk){
		var offset = chunk * (image.params.chunk_size - image.params.chunk_overlap);
		var chunk_color = (chunk % 3 > 0) ? ((chunk % 3 > 1) ? 'red' : 'green') : "blue";
		if(params.show_chunks){
			ctx.lineWidth = 3;
			ctx.fillStyle = ctx.strokeStyle = chunk_color
			if(ctx.setLineDash) ctx.setLineDash([4,4]);
			ctx.strokeRect(10 * (chunk % 2) + 0.5 + ctx.lineWidth, offset + ctx.lineWidth + 0.5, image.width - 2 * 10 * (chunk % 2) - 2 * ctx.lineWidth, image.params.chunk_size)
			ctx.fillText('Chunk ' + chunk, 20, offset + 20)
		}
	})

	if(params.show_stitching && image.stitch_debug){
		image.stitch_debug.forEach(function(line){
			if(ctx.setLineDash) ctx.setLineDash([]);
			ctx.lineWidth = 1
			if(line.type == 'orphan'){
				ctx.strokeStyle = 'orange'
			}else if(line.type == 'valid'){
				ctx.strokeStyle = 'green'
			}
			ctx.strokeRect(line.x0 + .5, line.y0 + .5, line.width, line.height)
		})
	}
	image.regions.forEach(function(col){

		if(params.show_regions){
			if(col.lines[0].direction == -1){
				ctx.fillStyle = 'rgba(255,255,0,' + ( col.finished ? 0.3 : 0.1 )+')'	
				ctx.strokeStyle = 'black'	
			}else{
				ctx.fillStyle = 'rgba(0,255,255,' + ( col.finished ? 0.3 : 0.1 )+')'
				ctx.strokeStyle = 'white'	
			}
			
			ctx.lineWidth = 2
			if(col.finished){
				ctx.lineWidth = 3
				if(ctx.setLineDash) ctx.setLineDash([]);
			}else{
				ctx.lineWidth = 3
				if(ctx.setLineDash) ctx.setLineDash([10,10]);
			}
			
			// ctx.strokeRect(col.x0 - 1, col.y0 - 1, col.width + 2, col.height + 2)
			// ctx.fillRect(col.x0, col.y0, col.width, col.height)

			ctx.save(); 
			ctx.translate(col.cx, col.cy)
			ctx.rotate(col.angle)
			ctx.strokeRect(-col.width/2, -col.height/2, col.width, col.height)
			// ctx.fillRect(-col.width/2, -col.height/2, col.width, col.height)
			ctx.restore()
		}
		ctx.lineWidth = 1
		var strokecolors = ['#FF69B4', 'red', 'green', 'blue', 'purple']
		col.lines.forEach(function(line, index){
			var chunk = line.chunk;
			var chunk_color = (chunk % 3 > 0) ? ((chunk % 3 > 1) ? 'red' : 'green') : "blue";

			ctx.strokeStyle = strokecolors[index % strokecolors.length]
			ctx.lineWidth = 1
			line.words.forEach(function(word){
				word.letters.forEach(function(letter){
					if(params.show_letters){
						if(ctx.setLineDash) ctx.setLineDash([]);
						ctx.strokeRect(letter.x0, letter.y0, letter.width, letter.height);
					}
					if(params.show_contours && letter.shape){
						// var offset = (image.params.chunk_size - image.params.chunk_overlap) * line.chunk
						letter.shape.forEach(function(c){
							if(line.direction == -1){
								ctx.fillStyle = '#FF69B4'
							}else{
								ctx.fillStyle = 'yellow'	
							}
							ctx.fillRect(letter.x0 + (c % letter.width), letter.y0 + Math.floor(c / letter.width), 1, 1)
							// ctx.fillRect(c % image.width, offset + Math.floor(c / image.width), 1, 1)
						})	
					}

				})
				if(params.show_words){
					ctx.strokeRect(word.x0 , word.y0, word.width, word.height)	
				}
				
			})


			if(params.show_lines){
				
				ctx.beginPath()
				if(ctx.setLineDash) ctx.setLineDash([]);
				// console.log(line)
				// ctx.moveTo(line.x0, line.cy)
				// ctx.lineTo(line.x1, line.cy)
				// ctx.strokeStyle = chunk_color
				// ctx.stroke()

				// var cy = line.cy - (params.chunk_size - params.chunk_overlap) * chunk;
				// if(!((cy >= params.chunk_overlap / 2 || chunk == 0) && 
				// 	(cy < params.chunk_size - params.chunk_overlap / 2 || chunk == num_chunks - 1))) return false;
				
				// var cy = (params.chunk_size - params.chunk_overlap) * chunk + params.chunk_overlap / 2
				
				ctx.strokeStyle = 'purple'
				ctx.lineWidth = 1;
				if(ctx.setLineDash) ctx.setLineDash([]);
				
				ctx.strokeStyle = strokecolors[index % strokecolors.length]
				
				if(line.direction == -1){
					ctx.fillStyle = 'rgba(255,255,0,0.3)'	
				}else{
					ctx.fillStyle = 'rgba(0,255,255,0.3)'	
				}
				ctx.save(); 
				ctx.translate(line.cx, line.cy)
				ctx.rotate(line.angle)
				ctx.fillRect(-line.width/2, -line.lineheight/2, line.width, line.lineheight)
				ctx.restore()
				// ctx.fillRect(line.x0, line.y0, line.width, line.height)

				ctx.beginPath()
				ctx.lineWidth = 3
				
				line.words.forEach(function(word){
					word.letters.forEach(function(letter){

						ctx.lineTo(letter.cx, letter.cy)
					})	
				})
				
				ctx.stroke()
			}
		})
	})
}




var is_shimmering = false;

function start_shimmer(){
	if(!is_shimmering) render_shimmer();
	return is_shimmering
}

function get_elapsed(image, region){

	if(!image.ocr) image.ocr = {};
	if(!image.plaster) image.plaster = {};
	if(!image.translate) image.translate = {};

	var elapsed = []

	if(region.id in image.ocr){
		if(image.ocr[region.id].processing){
			elapsed.push(-1)
		}else{
			elapsed.push(Date.now() - image.ocr[region.id].finished)	
		}
	}

	if(region.id in image.plaster){
		if(image.plaster[region.id].processing){
			elapsed.push(-1)
		}else{
			elapsed.push(Date.now() - image.plaster[region.id].finished)	
		}
	}

	if(region.id in image.translate && image.translate[region.id].language){
		if(image.translate[region.id].waiting){
			elapsed.push(-2)
		}else if(image.translate[region.id].processing){
			elapsed.push(-1)
		}else{
			elapsed.push(Date.now() - image.translate[region.id].finished)	
		}
	}

	return Math.min.apply(Math, elapsed)
}

function render_shimmer(){
	is_shimmering = false

	if(typeof sel == 'undefined' || !sel || !sel.img) return;

	var img = sel.img
	var image = im(img);

	var cols = image.regions.filter(function(region){
		if(!region.shimmer) return false;
		var elapsed = get_elapsed(image, region)
		if(elapsed > 1000) return false;
		return true;
	});
	
	if(cols.length == 0){
		layer_clear(img, 'shimmer')
		return;
	}

	var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
	cols.forEach(function(col){
		x0 = Math.min(x0, col.x0); y0 = Math.min(y0, col.y0)
		x1 = Math.max(x1, col.x1); y1 = Math.max(y1, col.y1)
	});

	var sx = (img.width / img.naturalWidth) / image.params.scale,
		sy = (img.height / img.naturalHeight) / image.params.scale;

	var paper = layer(img, 'shimmer', x0 * sx, y0 * sy)
	paper.width = Math.round((x1 - x0 + 1) * sx)
	paper.height = Math.round((y1 - y0 + 1) * sy)

	var ctx = paper.getContext('2d')
	var dat = ctx.createImageData(paper.width, paper.height)

	cols.forEach(function(col){
		// var elapsed = Date.now() - image.ocr[col.id].finished;
		var elapsed = get_elapsed(image, col)
		var time = (Date.now() - col.shimmer);

		col.lines.forEach(function(line){
			var offset = (image.params.chunk_size - image.params.chunk_overlap) * line.chunk
			
			var seed = line.y0;
			var seed2 = line.y1;
			for(var i = 0; i < 17; i++){
				// this is a linear congruential pseudorandom number generator
				// it's a pretty lame prng but all we need is something good
				// enough to semi-randomly distribute the initial positions
				// and parameters of the things
				seed  = ((1664525 * seed  + 1013904223) % 4294967296);
				seed2 = ((1664525 * seed2 + 1013904223) % 4294967296);
			}
			seed /= 4294967296;
			seed2 /= 4294967296;

			line.words.forEach(function(word){
				word.letters.forEach(function(letter){
					if(!letter.shape) return;
					for(var i = 0; i < letter.shape.length; i++){
						var c = letter.shape[i];

						var x = letter.x0 + (c % letter.width), 
							y = (letter.y0 + Math.floor(c / letter.width));
						
						var frac = 2 * seed + time / (2000 * (0.5 + seed2)) - x / Math.min(800, image.width);
						var interp = Math.pow(0.5 - Math.cos(frac * Math.PI * 2) / 2, 8);
						var opacity = Math.max(0, interp - 0.5) * Math.pow(Math.min(1, time / 500), 2)

						if(elapsed < 1000) opacity *= Math.max(0, 1 - elapsed / 300);
						
						opacity *= (line.direction > 0 ? 1 : 0.8);

						if(opacity > 0){
							var p = (dat.width * Math.round((y - y0) * sy) + Math.round((x - x0) * sx)) * 4;
							dat.data[p] = dat.data[p + 1] = dat.data[p + 2] = 255;
							dat.data[p + 3] = Math.floor(256 * opacity)
						}
					}
				})
			})
		})
	})

	ctx.putImageData(dat, 0, 0)

	requestAnimationFrame(render_shimmer)
	is_shimmering = true
}

var menu_levels = [];

var lastX, lastY;
var menu_overlay;
var typeCompletionTimeout;
var typeBuffer = '';

function menu_typedone(){
	clearTimeout(typeCompletionTimeout);
	// console.log(typeBuffer)
	typeBuffer = ''
	var menu = menu_levels[menu_levels.length - 1];
	if(menu && menu.selectedIndex > 0){
		[].forEach.call(menu.children, function(el){
			if(el.original) menu.replaceChild(el.original, el);
		})
		menu.change_selection(menu.selectedIndex, true)	
	}
}


function menu_keyhandle(e){
	if(e.shiftKey) return;
	function invalid_el(el){
		return el.tagName == "HR" || el.classList.contains("disabled")
	}
	if(e.keyIdentifier == 'Down'){
		var menu = menu_levels[menu_levels.length - 1];
		var index = menu.selectedIndex + 1;
		var cur_sel;

		while(invalid_el(cur_sel = menu.children[(index + menu.children.length) % menu.children.length])){
			index++;
		}
		menu.change_selection(cur_sel, true)
		e.preventDefault()
	}else if(e.keyIdentifier == 'Up'){
		var menu = menu_levels[menu_levels.length - 1];
		var index = menu.selectedIndex - 1;
		
		var cur_sel;

		while(invalid_el(cur_sel = menu.children[(index + menu.children.length) % menu.children.length])){
			index--;
		}
		menu.change_selection(cur_sel, true)
		e.preventDefault()
	}else if(e.keyIdentifier == 'Right'){
		menu_typedone()
		var menu = menu_levels[menu_levels.length - 1];

		if(menu){
			var index = menu.selectedIndex;
			if(index == -1){
				menu.change_selection(0)
			}else{
				var cur_sel = menu.children[(index + menu.children.length) % menu.children.length]
				menu.change_selection(cur_sel)
				if(menu_levels[menu_levels.length - 1] != menu){
					menu_levels[menu_levels.length - 1].change_selection(0, true)	
				}	
			}
			
		}
		e.preventDefault()
	}else if(e.keyIdentifier == 'Left'){
		if(menu_levels.length){
			create_menu([], menu_levels.length - 1)	
			e.preventDefault()
		}
	}else if(e.keyIdentifier == 'Enter' || e.keyIdentifier == 'U+0020'){
		menu_typedone()
		var menu = menu_levels[menu_levels.length - 1];
		menu.do_action(menu.selectedIndex)

		e.preventDefault()
	}else if(e.keyIdentifier == 'Esc' || e.keyIdentifier == 'U+001B'){
		create_menu([], 0) // close the menu

		e.preventDefault()
	}

	var keycode = e.keyCode;
	var valid = (keycode > 64 && keycode < 91); // letter keys
	
	var menu = menu_levels[menu_levels.length - 1];
	if(valid && menu){
		var letter = String.fromCharCode(e.keyCode);
		clearTimeout(typeCompletionTimeout);
		typeCompletionTimeout = setTimeout(menu_typedone, 500);

		typeBuffer += letter;
		// based off http://james.padolsey.com/javascript/replacing-text-in-the-dom-its-not-that-simple/
		var re = new RegExp(typeBuffer.split('').join('.*?'), 'ig');

		var has_match = false;
		[].forEach.call(menu.children, function(el){
			var orig = el.original || el;
			orig.removeAttribute('selected');
			var clone = orig.cloneNode(true);
			clone.original = orig;

			var temp = document.createElement('div');
			var text = [].map.call(clone.childNodes, function(node){
				return node.nodeType == 3 ? node.data : ''
			}).join('')

			
			re.lastIndex = 0;
			if(text.match(re)){
				has_match = true;
				clone.is_match = true;
			}

			;[].forEach.call(clone.childNodes, function(node){
				if(node.nodeType != 3) return;
				re.lastIndex = 0;
				temp.innerHTML = node.data.replace(re, '<u>$&</u>');
				while(temp.firstChild){
					node.parentNode.insertBefore(temp.firstChild, node)
				}
				node.parentNode.removeChild(node)
			})

			menu.replaceChild(clone, el);
		});

		var index = menu.selectedIndex;
		if(has_match){
			var cur_sel;
			while(!(cur_sel = menu.children[(index + menu.children.length) % menu.children.length]).is_match){
				index++;
			}
			menu.change_selection(cur_sel, true)
		}else{
			menu.change_selection(index, true)
		}


	}else{
		menu_typedone()
	}
}

function menu_handle(e){

	if(is_child(e.target, menu_levels[menu_levels.length - 1])){
		// the currently expanded menu
		var menu = menu_levels[menu_levels.length - 1];
		
		menu.change_selection(e.target)
		// console.log('change target', e.target)
	}else if(is_child(e.target, menu_levels[menu_levels.length - 2]) || e.target == menu_levels[menu_levels.length - 2]){
		// the parent menu
		var child_rect = menu_levels[menu_levels.length - 1].getBoundingClientRect();

		// we need to check to see if the cursor vector lies within the two
		// adjacent sides of the triangle formed by the edges of the child rect

		// in this case, p3 is the one which gets used as the origin
		// in our case, the origin is represented by lastX and lastY

		function side(px, py, x1, y1, x2, y2){
 			return (y2 - y1) * (px - x1) + (x1 - x2) * (py - y1);
		}

		function PointInSector(px, py, x1, y1, x2, y2, x3, y3){
			var cp1 = side(px, py, x1, y1, x2, y2) > 0,
				cp3 = side(px, py, x3, y3, x1, y1) > 0;
			return cp1 == cp3
		}
 		
 		var dx = ((child_rect.left / 2 + child_rect.right / 2) - lastX);

 		// is the box going to the left or right?
 		var far_edge = dx > 0 ? child_rect.right : child_rect.left,
 			close_edge = dx > 0 ? child_rect.left : child_rect.right;
		
		
		if( (e.clientX - lastX) / dx > 0 && // cursor must go in direction of the gradient
			PointInSector(e.clientX, e.clientY, 
						lastX, lastY, 
						lastY > child_rect.bottom ? far_edge : close_edge, child_rect.top, 
						lastY < child_rect.top ? far_edge : close_edge, child_rect.bottom)){
			// the cursor trajectory is plausibly toward the child
		}else{
			var menu = menu_levels[menu_levels.length - 2];
			menu.change_selection(e.target)
			// console.log('change target2', e.target)
		}
	}else{
		// anything else
		var indices = menu_levels.map(function(menu, i){ return [is_child(e.target, menu), i] })
					.filter(function(result){ return result[0] })
					.map(function(result){ return result[1] });
		if(indices.length){
			create_menu([], indices[0] + 1)	
		}else if(menu_levels[menu_levels.length - 1]){
			menu_levels[menu_levels.length - 1].change_selection(null)
			// create_menu([], menu_levels.length)	
		}
		// console.log('change target3', e.target, indices)
		// console.log('creating menu', index)
	}

	var cdamp = 0.8;
	
	lastX = e.clientX * cdamp + lastX * (1 - cdamp)
	lastY = e.clientY * cdamp + lastY * (1 - cdamp)

	if(!isFinite(lastX)) lastX = e.clientX;
	if(!isFinite(lastY)) lastY = e.clientY;
}


function create_menu(items, level){
	if(menu_levels.length == 0 && items.length == 0) return; 

	for(var i = level; i < menu_levels.length; i++){
		var m = menu_levels[i];
		if(m && m.parentNode){
			m.parentNode.removeChild(m)
		}
		menu_levels[i] = null;
	}
	menu_levels = menu_levels.filter(function(e){return e});
	if(level == 0 && items.length == 0){
		if(menu_overlay && menu_overlay.parentNode){
			menu_overlay.parentNode.removeChild(menu_overlay)
		}
	}
	if(items.length == 0){
		// menu_typedone()
		
		return		
	}

	var menu = document.createElement('menu')
	menu.style.fontFamily = systemFonts[getPlatform()];
	
	menu_levels[level] = menu;
	menu.level = level;

	items.forEach(function(item){
		if(item == '-'){
			menu.appendChild(document.createElement('hr'))
			return
		}
		var btn = document.createElement('button')
		btn.innerHTML = item.html
		
		if(item.checked){
			btn.setAttribute('checked', 'checked')	
		}
		if(item.group){
			btn.group = item.group;	
		}

		menu.appendChild(btn)
		btn.action = item.action;
		btn.toggle = item.toggle;
		if(item.items){
			// oh look it has a submenu
			btn.className += ' dropdown'
			btn.items = item.items;
		}

		if(item.disabled){
			// btn.setAttribute('disabled', 'disabled')
			btn.className += ' disabled gray'
		}else{
			if(item.gray){
				btn.className += ' gray'
			}
			
			if(item.cls){
				btn.className += ' ' + item.cls
			}
		}


	})
	// var selectedItem;
	menu.addEventListener('mouseup', function(e){
		var index = menu.change_selection(e.target)
		sel.deselect_time = Date.now()
		menu.do_action(index)
	})

	menu.do_action = function(index){
		if(index != -1){
			var btn = menu.children[index]
				
			if(btn.group){
				[].forEach.call(menu.children, function(alt){
					if(alt.group === btn.group){
						alt.removeAttribute('checked')
					}
				})
				btn.setAttribute('checked', 'checked')
			}else if(btn.toggle){
				if(btn.hasAttribute('checked')){
					if(btn.toggle(false)) create_menu([], 0);
					btn.removeAttribute('checked')
				}else{
					if(btn.toggle(true)) create_menu([], 0);
					btn.setAttribute('checked', 'checked')	
				}

			}else if(btn.action && !btn.classList.contains('disabled')){
				
				btn.action()
				// console.log('woop', btn.innerText)
				create_menu([], 0)
			}		
		}	
	}

	menu.selectedIndex = -1;
	menu.change_selection = function(index, no_expand){
		// console.log(index)
		if(typeof index != 'number'){
			for(var i = 0; i < menu.children.length; i++){
				if(menu.children[i] == index || is_child(index, menu.children[i])){
					index = i;
					break;
				}
			}
			if(typeof index != 'number') index = -1;
		}
		
		var old = menu.children[menu.selectedIndex],
			select = menu.children[index];

		if(old) old.removeAttribute('selected');
		if(select && !select.classList.contains('disabled')){
			select.setAttribute('selected', true);
			menu.selectedIndex = index;
		}else{
			menu.selectedIndex = null;
		}
		

		if(select && select.items){
			if(!no_expand){
				menu_typedone();
				var sub = typeof select.items == 'function' ? select.items() : select.items;

				sub_menu(sub, menu.level + 1, select.getBoundingClientRect())		
			}
			
		}else{
			create_menu([], menu.level + 1)
		}
		return index
	}
	menu.style.position = 'fixed'
	menu.style.top = '-1000px';
	menu.style.left = '-1000px';
	menu.style.zIndex = depth('menu')
	// document.body.appendChild(menu)
	

	if(!(menu_overlay && menu_overlay.parentNode)){
		menu_overlay = document.createElement('div')
		menu_overlay.className = "contextmenu_overlay"
		menu_overlay.style.zIndex = depth('overlay')
		// document.body.appendChild(menu_overlay)
		get_container().appendChild(menu_overlay)
		
		menu_overlay.addEventListener("mousewheel", function (e) {
			e.preventDefault();
			e.stopPropagation();
			return false;
		}, true);
	}

	menu_overlay.appendChild(menu)
	
	return menu
}

function sub_menu(items, level, rect){
	var menu = create_menu(items, level);
	var pad = 10;
	if(rect.top + menu.offsetHeight + pad > innerHeight){
		menu.style.top = (innerHeight - menu.offsetHeight - pad) + 'px';
	}else{
		menu.style.top = rect.top + 'px';
	}
	if(rect.right + menu.offsetWidth > innerWidth){
		menu.style.left = (rect.left - menu.offsetWidth) + 'px';
	}else{
		menu.style.left = rect.right + 'px';
	}
}


function context_menu(items, x, y){
	var menu = create_menu(items, 0)
	if(y + menu.offsetHeight > innerHeight){
		if(y - menu.offsetHeight < 0){
			menu.style.top = (innerHeight - menu.offsetHeight) + 'px'
		}else{
			menu.style.top = (y - menu.offsetHeight) + 'px'
		}
	}else{
		menu.style.top = y + 'px'
	}
	
	if(x + menu.offsetWidth > innerWidth){
		if(x - menu.offsetWidth < 0){
			menu.style.left = (innerWidth - menu.offsetWidth) + 'px'
		}else{
			menu.style.left = (x - menu.offsetWidth) + 'px'	
		}
	}else{
		menu.style.left = x + 'px'
	}
	menu.focus()
}

function is_child(el, parent){
	if(!parent) return null;

	while(el && el.parentNode != parent)
		el = el.parentNode;
	return el
}



systemFonts = {
  cros: 'Noto Sans UI, sans-serif',
  linux: 'Ubuntu, sans-serif',
  mac: 'Lucida Grande, sans-serif',
  win: 'Segoe UI, Tahoma, sans-serif',
  unknown: 'sans-serif'
};

// /**
//  * @return {string} The platform this extension is running on.
//  */
function getPlatform() {
  var ua = window.navigator.appVersion;
  if (ua.indexOf('Win') != -1) return 'win';
  if (ua.indexOf('Mac') != -1) return 'mac';
  if (ua.indexOf('Linux') != -1) return 'linux';
  if (ua.indexOf('CrOS') != -1) return 'cros';
  return 'unknown';
};

document.addEventListener('contextmenu', right_click, true)


function get_letters(region){
	return [].concat.apply([], region.lines.map(function letters_from_line(line){
		return [].concat.apply([], line.words.map(function(e){ return e.letters })) 
	})) 
}



function guess_engine(){
	var image = im(sel.img)
	var cols = (!sel.start && sel.stack.length == 0) ? image.regions : selected_regions();

	var popularity = {
		'tess:eng': 1 // bias it toward something
	};
	;((image.lookup || {}).chunks || []).forEach(function(e){
		// TODO: keep track of popularity on server of each
		// translation type
		popularity[e.engine] = (popularity[e.engine] || 0) + 1
	});
	
	var most_popular = Object.keys(popularity).sort(function(b, a){
		return popularity[a] - popularity[b]
	})[0];


	if(cols.filter(function(region){
		var letters = get_letters(region);
		var frac_up = letters.filter(function(e){ return e.height / region.xheight > 1.2 }).length / letters.length;
		// console.log('something something', region, frac_up, region.lettersize / region.xheight)
		if(frac_up < 0.05 && (region.lettersize / region.xheight) > 0.7){
			// oh look its all uppercased text	
			return true
		}
		return false
	}).length == cols.length){
		return "tess:joh"
	}else{
		return most_popular
	}
}


function right_click(e){
	var mouse = get_mouse(e);

	if(!mouse.img) return;
	var cursor = get_cursor(mouse);
	if(!cursor.region) return;

	e.preventDefault()
	e.stopImmediatePropagation()
	e.stopPropagation()

	if(menu_levels.some(function(menu){ return is_child(e.target, menu) })) return;
	
	var items = [];
	var image = im(mouse.img);
	var params = image.params;

	function check_sel(){
		if(sel.img != mouse.img){
			clear_selection() 
			sel.img = mouse.img 
		}
	}

	check_sel()

	// this code determines how far the current cursor position is
	// from the selection squig in spite of its pretty non rectilinear
	// or contiguous nature. it works by decomposing a squig into
	// little rectangles, measuring the distance between that and 
	// the cursor after taking into account all the weird layout
	// stuff and scaling

	var min_dist = Infinity;
	if(sel.stack.length > 0 || sel.start){
		var image = im(sel.img);
		var layout = image_layout(sel.img)

		var sx = sel.img.width / sel.img.naturalWidth / image.params.scale,
			sy = sel.img.height / sel.img.naturalHeight / image.params.scale;

		var boxes = [].concat.apply([], get_selection(sel, image).map(function(pair){
			return rectify_squig(pair[0], pair[1])
		})).map(function(box){
			return {
				x0: box.x0 * sx + layout.X,
				y0: box.y0 * sy + layout.Y,
				x1: box.x1 * sx + layout.X,
				y1: box.y1 * sy + layout.Y
			}
		})

		
		for(var i = 0; i < boxes.length && min_dist > 0; i++){
			var dist = point2rect(e.clientX, e.clientY, boxes[i])
			if(dist < min_dist){
				min_dist = dist;
			}
		}
	}




	// if the current selection isn't what was clicked on
	// if(!selected_regions().some(function(region){ return region.id == cursor.region.id })){

	if(min_dist > 20){
		clear_selection()
		if(cursor.line.words.length == 1){
			push_sel(cursor, cursor) // cursor cursor on the wall, which is the shortest line of all?
		}else{
			push_sel(
				{region: cursor.region, line: cursor.line, letter: cursor.word.letters[0]},
				{region: cursor.region, line: cursor.line, letter: cursor.word.letters[cursor.word.letters.length - 1]}
			)
		}
		update_selection()
		requestAnimationFrame(modify_clipboard)
	}

	var selection = get_selection(sel, image);

	items.push({
		html: "Copy Text", 
		disabled: selection.length == 0,
		action: function(){
			// document.execCommand('copy')
			// alert('not supported, use Ctrl+C or Cmd+C instead.')
			broadcast({
				type: 'copy',
				text: extract_selection(sel, image).text,
				id: image.id
			})
		}
	})

	if(virtualize_region(image, selected_regions()).some(function(region){ return region.virtual })){
		items.push({
			html: "Modify Text <small>(BETA)</small>",
			action: function(){
				selected_regions().filter(function(region){
					return virtualize_region(image, region).virtual == true
				}).forEach(function(region){
					var translate = image.translate[region.id]
					translate.text = prompt("Enter new text for region", translate.text)
					translate.language = 'custom'
					translate_region(image, region)
					update_selection()
				})
			}
		})
	}

	// items.push({ html: "Search for 'blah'...", disabled: selection.length == 0 })
	items.push({
		html: "Select All",
	 	// if everything's already selected, then uh don't like show this
		disabled: image.regions.length == selection.length, 
		action: function(){
			check_sel()
			image.regions.forEach(function(col){
				push_sel({ region: col })
			})
			update_selection()
		}
	})
	items.push({ html: "Open in New Tab", action: function(){
		// var base = document.createElement('canvas')
		// base.width = image.el.naturalWidth;
		// base.height = image.el.naturalHeight;
		// var btx = base.getContext('2d')
		// btx.drawImage(image.el, 0, 0)

		// open(base.toDataURL('image/png'))
		open(image.el.src)

	}})

	items.push('-')


	function engine(id, html){
		// var has_lookup = ((image.lookup || {}).chunks || []).some(function(e){
		// 	return e.engine == id 
		// });

		// var has_lookup = ((image.lookup || {}).chunks || []).some(function(e){
		// 	return e.engine == id 
		// });
		

		var has_lookup = selected_regions().some(function(region){
			return get_lookup_chunks(image, region).some(function(chunk){
				return chunk.engine == id
			})
		});


		var is_ideal = guess_engine() == id;
		var is_local = (id == 'ocrad');
		// console.log(guess_engine())

		return {
			html: html,
			// checked: get_ocr_engine(image) == id,
			checked: selected_regions().some(function(region){
				return (image.ocr[region.id] || { })._engine == id
			}),
			disabled: (global_params.demo_mode && !has_lookup) || (location.protocol == 'file:' && !is_local),
			// cls: (has_lookup || id == 'ocrad' || image.engine == id || id == guess_engine()) ? '': 'halfgray',
			cls: [is_ideal ? 'ideal' : '', (has_lookup || is_local) ? '' : 'halfgray'].join(' '),
			action: function(){
				check_sel()


				if(!image.ocr) image.ocr = {};

				selected_regions().forEach(function(region){
					var ocr = image.ocr[region.id];
					if(ocr && ocr.engine == id) return;
					image.ocr[region.id] = {
						engine: id,
						waiting: Date.now()
					}

					if(image.translate && image.translate[region.id]){
						var translate = image.translate[region.id]
						translate.waiting = Date.now()
						delete translate.finished
						delete translate.processing
					}
					region.shimmer = Date.now()
				})
				
				update_translations(image)

				update_selection()
				draw_overlays(image)

				start_shimmer()

			}
		}
	}
	function escape_html(text){
		var d = document.createElement('div');
		d.appendChild(document.createTextNode(text));  
		return d.innerHTML
	}

	function language_items(){
		var items = [
			engine('ocrad', "English <small>Ocrad.js</small>"),
		]

		if(/https?\:/.test(location.protocol)){
			items = items.concat([
				'-',
				engine("tess:eng", "English <small>Tesseract</small>"),
				engine("tess:joh", "Internet Meme"),
				engine("tess:rus", "Russian"),
				engine("tess:deu", "German"),
				engine("tess:spa", "Spanish"),
				engine("tess:chi_sim", "Chinese Simplified"),
				engine("tess:chi_tra", "Chinese Traditional"),
				engine("tess:fra", "French"),
				engine("tess:jpn", "Japanese"),
				// engine("tess:ara", "Arabic"), // arabic probably wont work well
			])
		}else{
			items.push({
				html: "<small>Remote OCR only for http(s) URLs</small>",
				disabled: true
			})
		}

		
		return items;
	}

	items.push({html: "Language", items: language_items})	


	if(!image.plaster) image.plaster = {};

	function translate(id, html){
		var unplastered = selected_regions().some(function(region){
			return !(region.id in image.plaster) 
		})

		var checked = selected_regions().some(function(region){
			return (!image.translate || image.translate[region.id] || {}).language == id
		})
		// console.log(((image.lookup || {}).translations || []))
		var has_lookup = ((image.lookup || {}).translations || []).some(function(e){ return e.target == id });
		

		var is_local = !id || (['erase', 'echo', 'esrever', 'pig'].indexOf(id) != -1)
		// var checked = unplastered ? (id == null) : (id == image.translate_lang);

		return {
			html: html,
			cls: (has_lookup || is_local || checked) ? '': 'halfgray',
			// disabled: tess_to_gtran[image.engine.split(':')[1]] == id,
			// checked: id == image.translate_lang
			disabled: (location.protocol == 'file:' && !is_local),
			checked: checked,

			action: function(){
				check_sel()
				// image.translate_lang = id

				if(!image.translate) image.translate = {};

				// image.translate = {}

				var cols = (!sel.start && sel.stack.length == 0) ? image.regions : selected_regions();
				// var cols = image.regions;
				
				console.log(cols, sel.start, sel.stack)

				if(id != 'erase'){
					// console.log("OMG RESET SOMETHING")
					// image.ocr = null;
					// image.engine = guess_engine()
					selected_regions().forEach(function(region){
						if(!image.ocr[region.id] || image.ocr[region.id].engine == 'default'){
							image.ocr[region.id] = {
								engine: get_ocr_engine(image, region, guess_engine()),
								waiting: Date.now()
							}
						}
						
					})
				}

				// re-add every selection but this time reincarnated
				// as something which selects all the regions
				clear_selection()
				cols.forEach(function(col){ push_sel({ region: col }) })
				
				cols.forEach(function(col){
					if(image.translate[col.id]){
						// nothing to change here
						if(image.translate[col.id].language == id) return;

						var el = image.translate[col.id].paper
						el.style.opacity = 0;

						setTimeout(function(){
							if(el.parentNode) el.parentNode.removeChild(el);
						}, 2000)
					}
					image.translate[col.id] = {
						language: id,
						waiting: Date.now()
					}
				})

				update_translations(image)
				start_shimmer()
				draw_overlays(image)
				update_selection()
			}
		}
	}
	function translate_items(){
		var items = [];
		items = items.concat([
			translate(null, 'No Translation'),
			translate('erase', 'Erase Text'),
			translate('echo', 'Reprint Text'),
		])

		if(selected_regions().some(function(region){ return (!image.translate || image.translate[region.id] || {}).language == 'custom' })){
			items.push(translate('custom', 'Custom Text'))
		}
		if(/https?\:/.test(location.protocol)){
			items = items.concat([
				// translate('echo', 'Change Text'),
				// {
				// 	html: 'Change Text',
				// 	action: function(){
				// 		console.log("merp")
				// 	}
				// },
				// translate('esrever', 'Reverse Text'),
				// translate('pig', 'Pig Latin'),
				'-',
				translate('en', 'English <small>Google Translate</small>'),
				translate('es', 'Spanish <small>Microsoft Translate</small>'),
				translate('ru', 'Russian <small>Yandex Translate</small>'),
				translate('zh-CN', 'Chinese Simplified'),
				translate('zh-TW', 'Chinese Traditional'),
				translate('ja', 'Japanese'),
				// translate('pt', 'Portuguese'),
				translate('de', 'German'),
				// translate('ar', 'Arabic'), // rtl probably doesnt work
				translate('fr', 'French'),
				// '-',
				// translate('echo', 'Change Text'),
				// translate('esrever', 'Reverse Text'),
				// translate('pig', 'Pig Latin'),
			])
		}else{
			items = items.concat([
				'-',
				translate('esrever', 'Reverse Text'),
				translate('pig', 'Pig Latin'),
				{
					html: "<small>Remote OCR only for http(s) URLs</small>",
					disabled: true
				}
			])
		}
		return items;
	}
	items.push({html: "Translate <small>(BETA)</small>", items: translate_items})
	items.push('-')

	items.push({html: "Options", items: [
		// {html: "Fast Plaster", checked: params.fast_plaster, toggle: function(val){
		// 	check_sel()
		// 	params.fast_plaster = val;
		// 	draw_plaster(sel.img, image)
		// }},
		// '-',
		{html: 'Show OCR Disclaimer', disabled: global_params.demo_mode, checked: get_setting('warn_ocrad'), toggle: function(val){
			// session_params.warn_ocrad = val;
			put_setting('warn_ocrad', val)

		}},
		{html: 'Disable lookup', disabled: global_params.demo_mode, checked: get_setting('no_lookup'), toggle: function(val){
			// session_params.no_lookup = val;
			put_setting('no_lookup', val)

		}},
		
		'-',
		{html: 'Disable for this image', disabled: true},
		{html: 'Disable on this page', disabled: true},
		// {html: 'Disable Naptha'},
		{html: 'Disable on <i>' + escape_html(location.hostname) + '</i>', disabled: true},
		'-',
		{html: 'Report Issue', action: function(){
			open("https://docs.google.com/forms/d/1WLitLvYOPefYOd9S2SeCcYCWb-fsfbyDCd8_moIR0C4/viewform?entry.467368810="+encodeURIComponent(image.src)+"&entry.149654426=" + encodeURIComponent(location.href))
		}}
		// {html: 'Dynamic Clock', items: function(){
		// 	return [
		// 		{html: (new Date).toString()}
		// 	]
		// }}

	]})
	items.push({html: "Advanced", items: [
		{html: "Show Regions", checked: session_params.show_regions, toggle: function(val){
			check_sel()
			session_params.show_regions = val
			draw_annotations(sel.img, image)
		}},
		{html: "Show Lines", checked: session_params.show_lines, toggle: function(val){
			check_sel()
			session_params.show_lines = val;
			draw_annotations(sel.img, image)
		}},
		{html: "Show Stitching", checked: session_params.show_stitching, disabled: !image.stitch_debug, toggle: function(val){
			check_sel()
			session_params.show_stitching = val;
			draw_annotations(sel.img, image)
		}},
		{html: "Show Letters", checked: session_params.show_letters, toggle: function(val){
			check_sel()
			session_params.show_letters = val;
			draw_annotations(sel.img, image)
		}},
		{html: "Show Contours", checked: session_params.show_contours, disabled: global_params.demo_mode, toggle: function(val){
			check_sel()
			session_params.show_contours = val;
			draw_annotations(sel.img, image)
		}},
		{html: "Show Chunks", checked: session_params.show_chunks, toggle: function(val){
			check_sel()
			session_params.show_chunks = val;
			draw_annotations(sel.img, image)
		}},
		'-',
		{html: "Clear State", disabled: global_params.demo_mode, action: function(val){
			check_sel()
			layer_clear(sel.img, '*')
			delete images[get_id(sel.img)];
		}},
		{html: "Debug Mode", disabled: global_params.demo_mode, checked: image.params.debug, toggle: function(val){
			check_sel()
			layer_clear(sel.img, '*')
			delete images[get_id(sel.img)];
			im(sel.img).params.debug = val;

			return true
		}}
	]})
	var button = "";
	if(!(image.lookup || {}).finished && (session_params.no_lookup || !navigator.onLine)){
		button = "<span class='credits-button offline'>offline</span>"	
	}else if(global_params.demo_mode){
		button = "<span class='credits-button low'>demo</span>"
	}else{
		// var button = "<span class='credits-button low'>100</span>"	

	}
	
	items.push({html: "naptha <small>0.7.2</small> "+button, gray: true, action: function(){
		open("http://projectnaptha.com/about/#"+global_params.user_id)
	}})
	
	context_menu(items, e.clientX, e.clientY)

}

/*
    https://github.com/paulirish/lazyweb-requests/issues#issue/19
    http://dev.w3.org/html5/2dcontext/#dom-context-2d-globalalpha
    http://radikalfx.com/files/collage/jcollage.js
    http://www.student.kuleuven.be/~m0216922/CG/fire.html
    http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
*/

function CanvasFlame (canvas) {  
    this.orig_canvas = document.createElement ("canvas");
    this.orig_context = this.orig_canvas.getContext ("2d");
    
    this.canvas = canvas;
    this.width = this.orig_canvas.width = this.canvas.width;
    this.height = this.orig_canvas.height = this.canvas.height;
    this.context = this.canvas.getContext ("2d");
    this.context.fillStyle = "rgba(0, 0, 0, 0)"
    this.context.fillRect (0, 0, this.width, this.height);
    this.image = this.context.getImageData (0, 0, this.width, this.height);
    this.data = this.image.data;

    this.palette = new Array (256);
    for (var i = 0; i <= 64;i++) {
        var alpha = Math.floor(Math.pow(Math.random(), 0.1) * 256)
        this.palette[i] = [i * 4, 0, 0, alpha];
        this.palette[i + 64] = [255, i * 4, 0, alpha];
        this.palette[i + 128] = [255, 255, i * 4, alpha];
        this.palette[i + 192] = [255, 255, 255, alpha];
    }

    this.updateEmbers()
    this.flames = new Uint8Array (this.width * this.height);
    for (var i = 0;i < this.width * this.height;i++) {
        this.flames[i] = 0;
    }
    this.started = false;
}

CanvasFlame.prototype.updateEmbers = function(){
    this.orig_image = this.orig_context.getImageData (0, 0, this.orig_canvas.width, this.orig_canvas.height);
    this.orig_data = this.orig_image.data;
    this.emits = new Uint8Array (this.width * this.height);
    for (var i = 0;i < this.emits.length;i++) {
        this.emits[i] = (this.orig_data[i * 4] + this.orig_data[i * 4 + 1] + this.orig_data[i * 4 + 2]) / 3 > 70;
    }
}

CanvasFlame.prototype.start = function (effect_duration, emit_duration) {
    if (this.started) return;
    this.started = true;
    this.stopEmit = false;
    var myself = this;
    var effect_time = effect_duration || 6.0;
    var emit_time = emit_duration || (effect_time - 2.0);
    if (emit_time > effect_time || emit_time < 0)
	emit_time = effect_time / 2.0;
    myself.loop()
};

CanvasFlame.prototype.stop = function () {
    this.started = false;
};

/* T.E. Lawrence, eponymously of Arabia, but very much an Englishman,
favored pinching a burning match between his fingers to put it out.
When asked by his colleague, William Potter, to reveal his trick --
how is it he so effectively extinguished the flame without hurting
himself whatsoever -- Lawrence just smiled and said, "The trick,
Potter, is not minding it hurts."

The fire that danced at the end of that match was a gift from the
Titan, Prometheus, a gift that he stole from the gods. When Prometheus
was caught and brought to justice for his theft, the gods, well, you
might say they overreacted a little. The poor man was tied to a rock
as an eagle ripped through his belly and ate his liver over and over,
day after day, ad infinitum. All because he gave us fire, our first
true piece of technology: Fire.
*/

CanvasFlame.prototype.loop = function () {
    var x, y, i;
    var run_count = 0;
    for (y = this.height - 2;y > -1;y--) {
	for (x = 0;x < this.width;x++) {
	    i = y * this.width + x;
	    this.flames[i] = (! this.stopEmit && this.emits[i]) ? (255 - Math.round (Math.random () * 70)) : Math.round (
		(
/* (x-1,y) */		+ (x > 0 ? this.flames[i - 1] : 0)
/* (x,y) */		+ this.flames[i]
/* (x+1,y) */		+ (x < this.width - 1 ? this.flames[i + 1] : 0)
/* (x-2,y+1) */		+ (x > 1 ? this.flames[i - 2 + this.width] : 0)
/* (x-1,y+1) */		+ (x > 0 ? this.flames[i - 1 + this.width] : 0)
/* (x,y+1) */		+ this.flames[i + this.width] * 2
/* (x+1,y+1) */		+ (x < this.width - 1 ? this.flames[i + 1 + this.width] : 0)
/* (x+2,y+1) */		+ (x < this.width - 2 ? this.flames[i + 2 + this.width] : 0)
		)
		* (0.97 + ((Math.random () - 0.5) * 0.3)) / 9.0);
	    if (this.flames[i] > 10 && this.flames[i] < 170) {
    		for (j = 0; j < 4; j++){
    		    this.data[i * 4 + j] = this.palette[this.flames[i] > 255 ? 255 : this.flames[i]][j];
            }
    		// this.data[i * 4 + 3] = 255;
            run_count++
	    } else {
            this.data[i * 4 + 3] = 0;    
        }
		
	}
    }
    if(run_count < 5){
        this.stop();
    }
    this.context.putImageData (this.image, 0, 0); //should be (0,0,this.width,this.height) but chrome throws NOT_SUPPORTED_ERR

    if(this.started){
        var myself = this;
        requestAnimationFrame(function(){
            myself.loop()
        })
    }
};