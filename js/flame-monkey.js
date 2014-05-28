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
	// window.parent.postMessage(data, '*')
    if(data.id){
        var parts = data.id.split("@#")
        // hopefully this isn't a security issue
        var tabId = parseInt(parts[1], 10);
        // console.log('sending data to', data.id, data)
        data.id = parts[0]
        chrome.tabs.sendMessage(tabId, data)
    }else{
        console.error("dont know where this data will be sent", data)
    }
}



// window.addEventListener('message', function(e){
// 	receive(e.data)
// })


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // sender.tab.id
    if(request.id){
        // console.log(sender.tab.id, request)    

        // request.id = sender.tab.id + "#/" + request.id
        request.id += "@#" + sender.tab.id;
        receive(request)

    }else{
        console.error("dont know where this data comes from", request)
    }
});


function inject_clipboard(region, ocr){
    var original = getClipboard();
    var incomplete = 0;
    var modified = substitute_recognition(original, function(region_id){
        if(region.id == region_id){
            // woot
            return {
                region: region,
                ocr: ocr
            }
        }
        incomplete++;
        return null;
    })
    if(incomplete == 0){
        // yay were done
        clipboard_watch = 0
    }
    if(original != modified){
        // omg changedzorz
        setClipboard(modified)
    }
}


// http://stackoverflow.com/questions/6969403/cant-get-execcommandpaste-to-work-in-chrome
function getClipboard() {
    var pasteTarget = document.createElement("div");
    pasteTarget.contentEditable = true;
    var actElem = document.activeElement.appendChild(pasteTarget).parentNode;
    pasteTarget.focus();
    document.execCommand("Paste", null, null);
    var paste = pasteTarget.innerText;
    actElem.removeChild(pasteTarget);
    return paste;
};

// https://coderwall.com/p/5rv4kq
function setClipboard(text){
    var copyDiv = document.createElement('div');
    copyDiv.contentEditable = true;
    document.body.appendChild(copyDiv);
    copyDiv.innerText = text;
    copyDiv.unselectable = "off";
    copyDiv.focus();
    document.execCommand('SelectAll');
    document.execCommand("Copy", false, null);
    document.body.removeChild(copyDiv);
}
var chunk_queue = [];
var chunk_processing = [];

var image_cache = {};
var image_cache_loading = {};

var client_id = "naptha006_" + uuid();
var clipboard_watch = 0;
var real_srcs = {}

function im(id){
	if(!(id in images)){
		throw "Error: image (" +id+" ) does not exist"
	}
	var image = images[id];
	if(!img_ready(image.src)){
		return null
	}
	var img = img_get(image.src);
	var params = image.params;

	if(!image.initialized){
		image.width = Math.round(img.naturalWidth * params.scale)
		image.height = Math.round(img.naturalHeight * params.scale)
		image.processed = []
		image.regions = []
		image.initialized = true;
	}

	return image;
}

function img_ready(src){
	var LOAD_TIMEOUT = 1000;
	var MAX_CONCURRENT = 3;

	if(src in image_cache){
		delete image_cache_loading[src];
		return true;
	}else if(src in image_cache_loading){
		return false;
	}else{
		var now = Date.now(), count = 0
		for(var key in image_cache_loading){
			var ts = image_cache_loading[key]
			if(now - ts > LOAD_TIMEOUT){
				delete image_cache_loading[key]
			}else{
				count++
			}
		}
		if(count < MAX_CONCURRENT){
			var img = new Image();
			
			img.src = real_srcs[src] || src;

			if(!img.complete){
				image_cache_loading[src] = Date.now()
				img.onload = function(){
					var load_end = Date.now()
					console.log(src, 'loaded in ', load_end - image_cache_loading[src])
					image_cache[src] = img;
					delete image_cache_loading[src];
				}	
			}else{
				image_cache[src] = img;
				console.log(src, 'loaded instantaneously')
				return true;
			}
		}
	}
	return false;
}

function img_get(src){
	if(img_ready(src)) return image_cache[src];
	throw "Image not yet ready"
}

// it takes an input in terms of natural cordinates
function img_cut(src, scale, x0, y0, w, h){
	var img = img_get(src)
	var canvas = document.createElement('canvas')
	
	// w = Math.min(img.naturalWidth - Math.floor(x0), w)
	// h = Math.min(img.naturalHeight - Math.floor(y0), h)

	canvas.width = Math.floor(w * scale)
	canvas.height = Math.floor(h * scale)

	var ctx = canvas.getContext('2d')
	
	// ctx.fillStyle = 'white'
	// ctx.fillStyle = 'rgb(155, 51, 181)'
	ctx.fillStyle = 'rgb(250,254,252)'

	ctx.fillRect(0, 0, canvas.width, canvas.height)
	

	var sx = (x0), sy = (y0);
	// firefox doesnt allow drawing an image with a negative
	// source start index
	var offx = Math.max(0, -sx),
		offy = Math.max(0, -sy);

	var remx = Math.max(0, (sx + (w)) - img.naturalWidth),
		remy = Math.max(0, (sy + (h)) - img.naturalHeight);


	// the area immediately under the area of interest is painted
	// white, for images which have semitransparent backgrounds
	ctx.fillStyle = 'white';
	ctx.fillRect(Math.round(offx * scale), Math.round(offy * scale),
		canvas.width - Math.round(offx * scale + remx * scale),
		canvas.height - Math.round(offy * scale + remy * scale))

	ctx.drawImage(img, Math.round(sx + offx), Math.round(sy + offy), 
		Math.round(w - offx - remx),  Math.round(h - offy - remy),  // swidth, sheight
		Math.round(offx * scale), Math.round(offy * scale),
		canvas.width - Math.round(offx * scale + remx * scale),
		canvas.height - Math.round(offy * scale + remy * scale))
	
	// console.image(canvas.toDataURL('image/png'))
	var im = ctx.getImageData(0, 0, canvas.width, canvas.height)
	
	delete ctx;
	delete canvas;

	return im;
}



function scaled_cut(src, scale, x0, y0, w, h){
	var img = img_get(src)
	var canvas = document.createElement('canvas')

	canvas.width = w
	canvas.height = h

	var ctx = canvas.getContext('2d')
	
	ctx.fillStyle = 'rgb(250,254,252)'
	ctx.fillRect(0, 0, canvas.width, canvas.height)

	ctx.drawImage(
		img, 
		Math.round(x0 / scale), Math.round(y0 / scale), // sx, sy
		Math.round(w / scale),
		Math.round(h / scale),  // swidth, sheight
		0, 0, // x, y
		canvas.width, canvas.height // width, height
	);

	var im = ctx.getImageData(0, 0, canvas.width, canvas.height)

	// console.image(ctx.canvas.toDataURL('image/png'))

	delete ctx;
	delete canvas;

	return im;
}



var images = {};



function broadcast_image(image){
	// console.log(image)
	// in theory, things have certain listners so that only if you subscribe to a given 
	// id, you'd receive a message like this
	// window.parent.postMessage({
	// 	regions: image.regions,
	// 	id: image.id,
	// 	chunks: Object.keys(image.processed)
	// 		.filter(function(e){ return image.processed[e] })
	// 		.map(function(e){ return parseInt(e) })
	// }, '*')

	broadcast({
		type: 'region',
		regions: image.regions,
		id: image.id,
		stitch_debug: image.stitch_debug,
		chunks: Object.keys(image.processed)
			.filter(function(e){ return image.processed[e] })
			.map(function(e){ return parseInt(e) })
	})
}

function receive(data){
	if(data.type == 'qchunk'){
		if(data.id in images){
			var image = im(data.id);
			var chunks = image ? data.chunks.filter(function(e){
				return !(e in image.processed)
			}) : data.chunks;

			if(chunks.length > 0){
				chunk_queue.unshift([data.id, chunks, data.time]);
				touch_scheduler();
			}
		}else{
			broadcast({
				id: data.id,
				type: 'getparam',
				initial_chunk: [data.id, data.chunks, data.time]
			})
		}
	}else if(data.type == 'gotparam'){
		if(!(data.id in images)){
			images[data.id] = {
				params: data.params,
				id: data.id,
				src: data.src
			}
			real_srcs[data.src] = data.real_src;

			if(data.initial_chunk){
				chunk_queue.unshift(data.initial_chunk);
				touch_scheduler();
			}
			console.log('creating a new image', data.id)
		}
	}else if(data.type == 'qocr'){
		queue_ocr(data)
	}else if(data.type == 'qpaint'){
		queue_paint(data)
	}else if(data.type == 'clipwatch'){
		clipboard_watch = Date.now()
	}else if(data.type == 'copy'){
		if(typeof setClipboard == 'function'){
			setClipboard(data.text)
		}else{
			alert("can not save to clipboard on platform")
		}
		
	}else{
		console.log('unknown data packet', data.type, data)
	}
}

function queue_ocr(data){
	// queue the generation of some kind of mask out of the thing
	// console.log(data.region)
	// var image = im(data.id)
	
	// scaled_cut(image.src, scale, x0, y0, w, h)
	var col = data.region;
	
	var avg_height = (col.original || col.lines).map(function(e){ return e.lineheight })
		.sort(function(a, b){ return a - b })[Math.floor(col.lines.length / 2)]; // take median

	var colscale = Math.min(10, Math.max(1, 100 / avg_height));
	
	// console.log('running ocr', data.reg_id)
	console.time('computing mask')

	var xpad = 5;
	var ypad = 5;

	mask_region(data.src, col, colscale, data.swtscale, data.swtwidth, xpad, ypad, function(output){
		console.timeEnd('computing mask')
		var mask = output.mask;
		// console.log('colors', output.colors)
		console.time("rotating stuff")
		var tmp = document.createElement('canvas')
		tmp.width = mask.cols;
		tmp.height = mask.rows;
		var tmx = tmp.getContext('2d')
		console.log(mask)
		var out = tmx.createImageData(mask.cols, mask.rows)
		for(var i = 0; i < mask.cols * mask.rows; i++){
			out.data[i * 4 + 3] = 255
			out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = mask.data[i] ? 0 : 255
		}
		tmx.putImageData(out, 0, 0)
		
		var reduce = 0.9;

		var rot = document.createElement('canvas')
		rot.width = Math.round(mask.cols * reduce);
		rot.height = Math.round(mask.rows * reduce);
		var rox = rot.getContext('2d')
		rox.fillStyle = 'white'
		rox.fillRect(0, 0, rot.width, rot.height)

		rox.translate(rot.width / 2, rot.height / 2)
		rox.rotate(-col.angle)
		rox.drawImage(tmp, -rot.width / 2, -rot.height / 2, rot.width, rot.height)
		console.timeEnd("rotating stuff")

		// console.image(rot.toDataURL('image/png'))
		var meta = {
			v: 3,
			id: col.id,
			x0: col.x0,
			y0: col.y0,
			x1: col.x1,
			y1: col.y1,
			ang: col.angle,
			dir: col.direction,
			red: reduce,
			cos: colscale,
			sws: data.swtscale,
			xp: xpad,
			yp: ypad
		};
		if(data.engine == 'ocrad'){
			var worker = new Worker(global_params.ocrad_worker)
			worker.onmessage = function(e){
				var raw = parseOcrad({ meta: meta, raw: e.data.raw });
				
				broadcast({
					type: 'recognized',
					id: data.id,
					reg_id: data.reg_id,
					text: e.data.text,
					engine: data.engine,
					raw: raw
				})

				if(Date.now() - clipboard_watch < 1000 * 60 && typeof inject_clipboard == 'function'){
        			// clipboard watch runs for 1 minutes
					inject_clipboard(col, { raw: raw })
				}
			}
			worker.postMessage({
				img: rox.getImageData(0, 0, rot.width, rot.height),
				invert: false
			})	
		}else if(data.engine.slice(0, 5) == 'tess:'){
			console.time('blobifying')
			rot.toBlob(function(blob){
				
				var formData = new FormData();
				formData.append("engine", data.engine);
				// formData.append("user", "naptha.js on localhost");
				formData.append('user', global_params.user_id)
				formData.append("url", data.src);
				formData.append("meta", JSON.stringify(meta));
				formData.append("channel", client_id)
				formData.append("image", blob, 'sample.png');
				var request = new XMLHttpRequest();
				request.open("POST", data.apiroot + "upload");
				request.send(formData);
				request.onerror = function(e){
					// console.log(request, e)
					broadcast({
						type: 'recognized',
						enc: 'error',
						id: data.id,
						reg_id: data.reg_id,
						engine: data.engine,
						text: "Error: Network error connecting to remote character recognition service"
					})
				}
				request.onload = function(){

					broadcast({
						type: 'recognized',
						enc: 'tesseract',
						id: data.id,
						reg_id: data.reg_id,
						engine: data.engine,
						text: request.responseText
					})

					if(Date.now() - clipboard_watch < 1000 * 60 && typeof inject_clipboard == 'function'){
	        			// clipboard watch runs for 1 minutes
	        			var raw = parseTesseract(JSON.parse(request.responseText))
						inject_clipboard(col, { raw: raw })
					}
				}
			}, 'image/png')
			console.timeEnd('blobifying')
		}else{
			console.warn("no recognized ocr engine available")
		}

	})
}


var WORKERCOUNT = 0;

function process_queue(){
	var found_chunk;
	// go through the chunk queue looking for something which
	// appears to be loaded and can be processed and then uh
	// do the processing on said chunk
	for(var i = 0; i < chunk_queue.length && !found_chunk; i++){
		var job = chunk_queue[i];
		if(!job) continue;
		var id = job[0];

		if(!(id in images) || !img_ready(images[id].src)) continue;
		if(job[1].length == 0){ chunk_queue[i] = null; continue; }
		
		var assigned = job[2];

		if(assigned < Date.now() - global_params.queue_expires) continue;
		// var image = images[id];
		var image = im(id);
		var params = image.params;


		var num_chunks = Math.max(1, Math.ceil((image.height - params.chunk_overlap) / (params.chunk_size - params.chunk_overlap)));

		while(job[1].length > 0 && !found_chunk){
			// console.log(job)
			// if(typeof job[1][0] == 'number'){
			// 	job[1].unshift(to_chunks(job[1].shift() * params.scale, image))
			// }
			// if(job[1][0].length == 0){
			// 	job[1].shift(); // this set of chunks is done
			// 	continue;
			// }
			var chunk = job[1].shift();
			if(
				chunk >= 0 &&
				chunk < num_chunks &&
				isFinite(chunk) &&
				// !(chunk in image.processing) && 
				!chunk_processing.some(function(e){
					return e[0] == id && e[1] == chunk
				}) &&
				!(chunk in image.processed)
			){
				found_chunk = true;
			}
		}
	}
	
	chunk_queue = chunk_queue.filter(function(e){ return e }); // get rid of the blank ones

	if(!found_chunk) return; // future unclear; try again later

	chunk_processing.push([id, chunk]);
	// image.processing[chunk] = 1;

	
	// console.log(images[id].height, chunk, (params.chunk_size - params.chunk_overlap) * chunk)

	var offset = chunk * (params.chunk_size - params.chunk_overlap);


	function save_lines(lines){
		lines.forEach(function(line, index){
			line.y0 += offset; line.y1 += offset; line.cy += offset;
			line.chunk = chunk;
			line.letters.forEach(function(e){
				e.y0 += offset; e.y1 += offset; e.cy += offset;	
			})
		})
		var has_before = lines.some(function(line){
			var cy = line.cy - (params.chunk_size - params.chunk_overlap) * chunk;
			return !(cy >= params.chunk_overlap / 2 || chunk == 0)
		})
		var has_after = lines.some(function(line){
			var cy = line.cy - (params.chunk_size - params.chunk_overlap) * chunk;
			return !(cy < params.chunk_size - params.chunk_overlap / 2 || chunk == num_chunks - 1)
		})


		if(has_before) chunk_queue.push([id, [chunk - 1], assigned]);
		if(has_after) chunk_queue.push([id, [chunk + 1], assigned]);


		// console.log('has before/after', has_before, has_after, chunk, JSON.stringify(chunk_queue, null, '  '));

		image.processed[chunk] = lines
		
		chunk_processing = chunk_processing.filter(function(e){
			return !(e[0] == id && e[1] == chunk)
		})

		touch_scheduler()
		// delete image.processing[chunk]
		
		update_regions(image);
	}

	var worker = new Worker(global_params.swt_worker);

	worker.onmessage = function(e){
		var msg = e.data;

		// console.log('done', src, chunk, found_chunk)

		if(msg.action == 'swtdat'){
			worker.terminate();
			save_lines(msg.lines)
		}else if(msg.action == 'vizmat'){
			visualize_matrix(msg.matrix, msg.letters)
			console.log('matrix visualizations not implemented')
		}else if(msg.action == 'grouptask'){
			console.groupCollapsed(msg.logs.slice(-1)[0][1], chunk)
			msg.logs.slice(0, -1).forEach(function(e){
				if(e[0] == '$end'){
					console.groupEnd()
				}else if(e[0] == '$start'){
					console.groupCollapsed(e[1])
				}else if(e[0] == '$log'){
					console.log(e[1])	
				}
			})
			console.groupEnd()
		}

	}
	
	var chunk_height = Math.min(params.chunk_size, image.height - (params.chunk_size - params.chunk_overlap) * chunk);
	
	// var dat = img_cut(
	// 	image.src, params.scale, 
	// 	0, offset / params.scale, 
	// 	Infinity, chunk_height / params.scale
	// );

	// var canvas = document.createElement('canvas')
	// canvas.width = image.width
	// canvas.height = image.height
	// var ctx = canvas.getContext('2d')
	// ctx.drawImage(img_get(image.src), 0, 0, canvas.width, canvas.height)
	// var dat = ctx.getImageData(0, offset, image.width, chunk_height);


	// convert this into an img_cut?
	var dat = scaled_cut(
		image.src, params.scale, 
		0, offset, 
		image.width, chunk_height
	);

	// var blah = document.createElement('canvas')
	// blah.width = image.width
	// blah.height = chunk_height
	// var dat = blah.getContext('2d').createImageData(image.width, chunk_height)

	// console.log(dat, image.width, offset, chunk_height)
	// var im = images[id].context.getImageData(0, offset, images[id].width, chunk_height);
	// show_image_data(im)
	// console.log(chunk, id, im)
	worker.postMessage({
		action: 'swt',
		imageData: dat,

		params: image.params
	})
	// var lines = partial_swt(im, swt_params);
	
}



function update_regions(image){
	var params = image.params;
	var num_chunks = Math.max(1, Math.ceil((image.height - params.chunk_overlap) / (params.chunk_size - params.chunk_overlap)))
	var valid_lines = []
	var process_count = 0;

	// for(var i = 0; i < num_chunks; i++){
	// 	var before = image.processed[i - 1],
	// 		lines = image.processed[i],
	// 		after = image.processed[i + 1];
	// }

	// var blah = document.createElement('canvas')
	// blah.width = image.width
	// blah.height = image.height
	// var ctx = blah.getContext('2d')
	// ctx.drawImage(img_get(image.src), 0, 0, image.width, image.height)
	// num_chunks
	image.processed.forEach(function(lines, chunk){
		var line_counter = 0;
		process_count++
		lines.forEach(function(line){
			// line.id = line_counter++;
			line.id = chunk.toString(36) + ':' + (line_counter++).toString(36)
		})
	})


	// image.processed.forEach(function(lines, chunk){
	// 	process_count++
	// 	lines.forEach(function(line){
	// 		line.id = line_counter++;
	// 		var cy = line.cy - (params.chunk_size - params.chunk_overlap) * chunk;
	// 		var is_before = (cy < params.chunk_overlap / 2 && chunk != 0);
	// 		var is_after = (cy >= params.chunk_size - params.chunk_overlap / 2 && chunk != num_chunks - 1);
			
	// 		// ctx.strokeStyle = 'green'
	// 		// ctx.strokeRect(line.x0, line.y0, line.width, line.height)

	// 		if(!is_before && !is_after)
	// 			valid_lines.push(line);
	// 	});
	// });

	function intersects(a, b){
		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
		// return width > 0 && height > 0
		return width > Math.min(a.width, b.width) * 0.7 &&
			   height > Math.min(a.height, b.height) * 0.7
	}


	// basically what this does, is it goes through each chunk
	// and searches for all the intersections with the previous remainder
	// for the intersecting lines, it picks the set which has a certain
	// desireable trait, for the elements of the remainder with no
	// intersections with the current, we add those to the valid lines
	// list, and all the other non-matches comprise the remainder
	// for the next iteration

	var last = image.processed[0]
	var orphaned_lines = [];

	for(var i = 1; i < num_chunks; i++){
		var n = 1;
		var lines = (image.processed[i] || []).filter(function(line){
			var offset = line.chunk * (params.chunk_size - params.chunk_overlap)
			var dist_top = Math.max(0, line.y0 - offset),
				dist_bot = Math.max(0, (offset + params.chunk_size) - line.y1);
			// return Math.min(dist_top, dist_bot) > 1
			return true
		}).map(function(line){
			return { geom: line, id: n++}
		});
		var prev = ((image.processed[i - 1] ? last : null) || []).map(function(line){
			return { geom: line, id: n++}
		});
		var forest = new UnionFind(n)

		lines.forEach(function(a){
			prev.forEach(function(b){
				if(intersects(a.geom, b.geom) && a.geom.direction == b.geom.direction){
					// set a = b
					forest.link(a.id, b.id)
				}
			})
		})
		var groups = {};
		lines.forEach(function(e){
			var name = forest.find(e.id)
			if(!(name in groups)) groups[name] = { cur: [], prev: [] };
			groups[name].cur.push(e.geom)
		})
		prev.forEach(function(e){
			var name = forest.find(e.id)
			if(!(name in groups)) groups[name] = { cur: [], prev: [] };
			groups[name].prev.push(e.geom)
		})
		function margin(lines){
			return Math.min.apply(Math, lines.map(function(line){
				var offset = line.chunk * (params.chunk_size - params.chunk_overlap)
				var dist_top = Math.max(0, line.y0 - offset),
					dist_bot = Math.max(0, (offset + params.chunk_size) - line.y1);
				return Math.min(dist_top, dist_bot)
			}))
		}
		function alt_metric(lines){
			// return lines.map(function(line){
			// 	return line.size
			// }).reduce(function(a, b){ return a + b })
			// return lines.reduce(function(a, b){
			// 	return a.lettercount + b.lettercount
			// })
			return Math.max.apply(Math, lines.map(function(line){
				return line.lettercount
			}))
		}
		var new_last = []
		for(var j in groups){
			var g = groups[j];


			if(g.cur.length == 0){
				valid_lines = valid_lines.concat(g.prev)
			}else if(g.prev.length == 0){
				new_last = new_last.concat(g.cur)
			}else{
				var cur_margin = margin(g.cur),
					pre_margin = margin(g.prev);
				// pick the line which is furthest away from the chunk boundary
				
				var proximity = (alt_metric(g.cur) - alt_metric(g.prev)) / (alt_metric(g.prev) + alt_metric(g.cur))

				if(Math.min(cur_margin, pre_margin) < params.chunk_size / 4 && proximity < 0.5){
					valid_lines = valid_lines.concat(cur_margin > pre_margin ? g.cur : g.prev)		
					orphaned_lines = orphaned_lines.concat(cur_margin < pre_margin ? g.cur : g.prev)
				}else{
					// unless they're both safe, in which case, we pick the one which has moar pixels
					var cur_alt = alt_metric(g.cur),
						pre_alt = alt_metric(g.prev);
					valid_lines = valid_lines.concat(cur_alt > pre_alt ? g.cur : g.prev)		
					orphaned_lines = orphaned_lines.concat(cur_alt < pre_alt ? g.cur : g.prev)		
				}
				
			}

			
		}
		last = new_last

	}

	valid_lines = valid_lines.concat(last)


	image.stitch_debug = orphaned_lines.map(function(line){
		return {x0: line.x0, y0: line.y0, width: line.width, height: line.height, 
				direction: line.direction, type: 'orphan'}
	}).concat(valid_lines.map(function(line){
		return {x0: line.x0, y0: line.y0, width: line.width, height: line.height, 
				direction: line.direction, type: 'valid'}
	}));

	// var blah = document.createElement('canvas')
	// blah.width = image.width
	// blah.height = image.height
	// var ctx = blah.getContext('2d')
	// ctx.drawImage(img_get(image.src), 0, 0, image.width, image.height)
	// ctx.lineWidth = 2;
	// orphaned_lines.forEach(function(line){
	// 	ctx.strokeStyle = 'blue'
	// 	ctx.strokeRect(line.x0, line.y0, line.width, line.height);
		
	// })
	// valid_lines.forEach(function(line){
	// 	ctx.strokeStyle = 'red'
	// 	ctx.strokeRect(line.x0, line.y0, line.width, line.height);
	// })

	// console.image(blah.toDataURL('image/png'))

	// var blah = document.createElement('canvas')
	// blah.width = image.width
	// blah.height = image.height
	// var ctx = blah.getContext('2d')
	// ctx.drawImage(img_get(image.src), 0, 0, image.width, image.height)
	// ctx.lineWidth = 2;
	// orphaned_lines.forEach(function(line){
	// 	ctx.strokeStyle = 'yellow'
	// 	if(line.direction < 0) ctx.strokeRect(line.x0, line.y0, line.width, line.height);
		
	// })
	// valid_lines.forEach(function(line){
	// 	ctx.strokeStyle = 'green'
	// 	if(line.direction < 0) ctx.strokeRect(line.x0, line.y0, line.width, line.height);
	// })

	// console.image(blah.toDataURL('image/png'))

	// visualize_matrix(valid)
	// console.log(valid_lines)
	// ctx.strokeStyle = 'black'
	// valid_lines.forEach(function(line){
	// 	ctx.strokeRect(line.x0, line.y0, line.width, line.height)
	// })
	// console.image(blah.toDataURL('image/png'))
	

	// image.regions = new_regions
	// Ximage = image
	

	function set_regions(regions){
		image.regions = regions.filter(function(col){
			return col.lettercount > 2
		}).sort(function(a, b){
			return a.y1 - b.y1
		})
		// image.regions = calculate_regions(valid_lines, params)
		image.regions.forEach(function(col){
			col.id = col.lines.map(function(line){ return line.id }).join('-');
			
			col.scale = image.params.scale

			col.finished = !col.lines.some(function(line){
				var chunk = line.chunk;
				// a column is declared "finished" if all the chunks directly above or below all its
				// component lines are finished with processing, because once that's done, it's quite
				// unlikely that adding other sections of the page will affect the contents of this
				// particular chunk
				var has_before = (chunk == 0 || image.processed[chunk - 1])
				var has_after = (chunk == num_chunks - 1 || image.processed[chunk + 1])
				return !has_before || !has_after; // if you dont have before or after, you're not done
			})

			// if(col.id in old_cols && old_cols[col.id].finished){
			// 	// if it's been marked as finished, then we have to consider it done
			// 	return old_cols[col.id]
			// }else{
			// return col
			// }
		})

		broadcast_image(image)
		// if(sel.img && image.src == sel.img.src){
		// 	// var sel = sel.img.naptha_sel
		// 	render_selection(sel.img, get_selection(sel, image), image.params)	
		// }

		if(process_count == num_chunks){
			// console.log('done', image.id)
			
			// remove everything involving it from the queue
			chunk_queue = chunk_queue.filter(function(e){
				return e[0] != image.id
			})

			setTimeout(function(){
				// wait some time so that the stuff can propage to the listeners
				// and then remove it
				// console.log('removing', image.id)
				delete images[image.id]
			}, 500)
			
			
		}	
	}
	
	set_regions(calculate_regions(valid_lines, params))
	// var worker = new Worker('lib/swt/regionworker.js')
	// worker.onmessage = function(e){
	// 	update_regions(e.data.regions)
	// }
	// worker.postMessage({
	// 	action: 'region',
	// 	lines: valid_lines,
	// 	params: params
	// })

	
}


function show_image_data(im){
	var c = document.createElement('canvas')
	c.width = im.width;
	c.height = im.height;
	var x = c.getContext('2d')
	x.putImageData(im, 0, 0)
	console.image(c.toDataURL('image/png'))
	// document.body.appendChild(c)
	return x
}

function alpha_image_data(im){
	var ctx = show_image_data(im)
	var merp = document.createElement('canvas')
	merp.width = ctx.canvas.width
	merp.height = ctx.canvas.height
	document.body.appendChild(merp)
	console.log(merp)
	merp = merp.getContext('2d')
	merp.beginPath()
	merp.strokeStyle = '#e0e0e0'
	for(var i = 0; i < Math.max(ctx.canvas.width, ctx.canvas.height) * 2; i+=5){
		merp.moveTo(0, i)
		merp.lineTo(i, 0)
	}
	merp.stroke()
	merp.drawImage(ctx.canvas, 0, 0)
	console.image(merp.canvas.toDataURL('image/png'))
}


function visualize_matrix(mat, letters){
	var c = document.createElement('canvas')
	c.width = mat.cols;
	c.height = mat.rows;
	var cx = c.getContext('2d')
	var out = cx.createImageData(mat.cols, mat.rows);
	for(var i = 0; i < mat.rows * mat.cols; i++){

		out.data[i * 4 + 3] = 255
		if(mat.data[i] == 1){
			out.data[i * 4] = 255
			// out.data[i * 4 + 1] = out.data[i * 4 + 2] = 30 * mat.data[i]
		}else{
			out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = 30 * mat.data[i]	
		}
		
	}
	cx.putImageData(out, 0, 0)
	
	if(letters){
		cx.strokeStyle = 'red'
		for(var i = 0; i < letters.length; i++){
			var letter = letters[i];
			cx.strokeRect(letter.x0 + .5, letter.y0 + .5, letter.width, letter.height)
		}

		if(letters[0] && letters[0].letters){
			// hey look not actually letters
			letters.forEach(function(line){
				cx.beginPath()
				var colors = ['green', 'blue', 'red', 'purple', 'orange', 'yellow']
				cx.strokeStyle = colors[Math.floor(colors.length * Math.random())]
				cx.lineWidth = 3

				line.letters
					.sort(function(a, b){ return a.cx - b.cx })
					.forEach(function(letter){
						cx.lineTo(letter.cx, letter.cy)
					})

				cx.stroke()
			})
		}
	}
	document.body.appendChild(c)

	console.image(c.toDataURL('image/png'))

	return cx
}

function touch_scheduler(){
	// perhaps delay task execution so that all the tasks are executed out-of-phase
	// that way there's always going to be a worker available for high-priority
	// processing
	if(chunk_processing.length < global_params.num_workers){
		process_queue()
	}
}

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
// note that columns is a misnomer - we actually mean something
// that's more analogous to the concept of a paragraph or 
// text region than an actual column

function calculate_regions(lines, params){
	
	console.time("find regions")
	
	function wrap_regions(lines){
		lines = lines.sort(function(a, b){ return a.cy - b.cy })

		var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0, sk = 0, sa = 0, sh = 0, sl = 0, st = 0, sxh = 0, ls = 0;
		// console.log(lines.map(function(e){ return e.lettersize }))
		for(var i = 0; i < lines.length; i++){
			var line = lines[i];
			sk += line.angle * line.lettercount; sa += line.lettercount;
			sh += line.lineheight;
			sl += line.lettercount;
			st += line.thickness;
			sxh += line.xheight;
			ls += line.lettersize;
			x0 = Math.min(x0, line.x0); y0 = Math.min(y0, line.y0);
			x1 = Math.max(x1, line.x1); y1 = Math.max(y1, line.y1);
		}
		if(sl < 5 && sk / sa < 0.1){  // this is about 6 angular degrees
			sk = 0
		}
		return {
			lines: lines,
			direction: lines[0].direction,
			angle: sk / sa, // the angle of the paragraph is the weighted average of line angls
			lineheight: sh / lines.length,
			xheight: sxh / lines.length,
			lettercount: sl,
			lettersize: ls / lines.length,
			x0: x0,
			y0: y0,
			thickness: st / lines.length,
			y1: y1,
			x1: x1,
			cx: x0 + (x1 - x0) / 2,
			cy: y0 + (y1 - y0) / 2,
			width: x1 - x0,
			height: y1 - y0,
			area: (x1 - x0) * (y1 - y0)
		}
	}

	// connect together lines which have similar alignment parameters
	var regions = equivalence_classes(lines, function(a, b){
		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);

		// assume that lines within paragraphs of text are either left-aligned, right-aligned or centered
		// (weird font things like justify can just be treated as left-aligned or right-aligned)
		// this means that our metric for align-ed-ness is the minium distance from such an alignment
		var align_offset = Math.min(Math.abs(a.x0 - b.x0), Math.abs(a.x1 - b.x1), Math.abs(a.cx - b.cx))
		
		var ratio = a.thickness / b.thickness;
		
		if(ratio > params.thickness_ratio || ratio < 1 / params.thickness_ratio) return false;
		
		if(Math.max(a.height, b.height) / Math.min(a.height, b.height) > 2) return false;

		if( width > 0 && 
			height < params.min_linespacing * (a.height/2 + b.height/2)  &&
			// width > Math.max(a.width, b.width) * 0.2 &&
			// width > Math.min(a.width, b.width) * 0.7 &&
			// -height > params.min_linespacing * Math.min(a.height, b.height) &&
			-height < params.max_linespacing * (a.height/2 + b.height/2) &&
			Math.max(a.avgheight, b.avgheight) / Math.min(a.avgheight, b.avgheight) < 1.7 &&
			align_offset / Math.max(a.width, b.width) < params.max_misalign &&
			Math.abs(a.angle - b.angle) < 0.1 && 
			a.lettercount > 2 && b.lettercount > 2 && 
			Math.abs(a.lettersize - b.lettersize) / Math.min(a.lettersize, b.lettersize) < params.lettersize &&
			Math.abs(a.xheight - b.xheight) / Math.min(a.xheight, b.xheight) < params.lettersize &&
			a.direction == b.direction
			){
				return true;
		}
		return false
	}).map(wrap_regions)

	// var regions = [].concat.apply([], regions.map(function(col){
	// 	var lines = col.lines;
	// 	// split colums vertically with the otsu threshold for line spacing

	// 	var rows = lines.sort(function(a, b){ return a.cy - b.cy })
	// 	return otsu_cluster(rows, function(cur, next){
	// 		return Math.max(0, next.y0 - cur.y1)
	// 	}, params.col_breakdown).map(wrap_regions)
	// }))

	// merge the regions that overlap with each other excessively

	// regions = regions.filter(function(a){
	// 	var overlap = 0;
	// 	regions.forEach(function(b){
	// 		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
	// 			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
	// 		if(width > 0 && height > 0){
	// 			overlap += width * height;	
	// 		}
	// 	})

	// 	if(width > 0 && height > 0 && width * height > 0.2 * Math.min(a.area, b.area)){
	// 		if(a.area > b.area){
	// 			return true;
	// 		}
	// 	}
	// })
	regions = [].concat.apply([], equivalence_classes(regions, function(a, b){
		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
		if(width > 0 && height > 0 && width * height > 0.2 * Math.min(a.area, b.area)){
			return true;
		}
		return false;
	}).map(function(group){
		// regions can only have lines of one type of direction, but if they're too close
		// then we'll have to merge the regions and abandon the one that's smaller
		var dir = 0, weight = 0;
		function sum(arr){return arr.reduce(function(a,b){return a + b})}

		function score(region){
			// what the fuck does this even do?
			// i don't know
			return sum(equivalence_classes(region.letters, function(a, b){
				var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
					height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
					return(width > -2 && height > -2)
			}).map(function(letters){
				// var avg_weight = sum(letters.map(function(letter){
				// 	// return letter.markweight
				// 	return letter.thickness
				// })) / letters.length
				var avg_weight = letters.map(function(letter){
					// return letter.thickness
					
					return Math.min(
						letter.thickness,
						// this is an upper bound of the stroke width
						// and the stroke width might be vastly larger
						// than what it could possibly be because of the 
						// lack of a second stage SWT out of performance
						// concerns
						letter.size / Math.min(letter.width, letter.height)
					)
				}).sort(function(a, b){
					return a - b
				})[Math.floor(letters.length / 2)]
				// var avg_weight = region.lettersize
				return avg_weight * Math.sqrt(Math.max.apply(Math, letters.map(function(letter){
					return letter.width
				})))
			}))
			// return sum(region.letters.filter(function(a){
			// 	return region.letters.some(function(b){
			// 		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			// 			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
			// 		return !(width > 0 && height > 0)
			// 	})
			// }).map(function(letter){
			// 	return 1
			// }))
		}

		group.forEach(function(col){
			col.lines.forEach(function(line){
				var val = score(line)
				dir += line.direction * val
				weight += val
			})
			// dir += col.lines[0].direction * col.lettercount;
			// weight += col.lettercount
		})

		dir = Math.round((dir/weight - 0.001) / Math.abs(dir/weight - 0.001))
		// return wrap_regions([].concat.apply([], group.map(function(col){return col.lines})).filter(function(line){
		// 	return line.direction == dir
		// }))

		return group.filter(function(col){
			return col.lines[0].direction == dir
		})

		// return group.filter(function(col){
		// 	return col.lines[0].direction == dir
		// }).sort(function(b, a){
		// 	return a.area - b.area
		// })[0]
	}))

	// if some vertically adjacent regions have similar line spacing, then
	// they deserve to be merged

	regions = [].concat.apply([], equivalence_classes(regions, function(a, b){
		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);

		// console.log('regions', a.lines.length + b.lines.length)

		if( a.direction == b.direction && // all cols must be same dir
			Math.abs(a.lettersize - b.lettersize) / Math.min(a.lettersize, b.lettersize) < params.lettersize &&
			a.lines.length + b.lines.length > 2 && // this only works if we have lots of lines in order for the line spacing to be statistically valuable
			width >= 0.9 * Math.min(a.width, b.width) && // needs to have lots of line overlap to assure that one is over another
			height < 0 && -height < 2 * Math.max(a.lineheight, b.lineheight) && // some mild heuristic for how close they have to be
			Math.max(a.lineheight, b.lineheight) / Math.min(a.lineheight, b.lineheight) < 1.5 // they have to be close
			){
			
			var adjs = otsu_adjacent([].concat.apply([], [a, b].map(function(f){ return f.lines })).sort(function(l1, l2){ return l1.cy - l2.cy }), function(cur, next){
				return Math.max(0, next.cy - cur.cy)
			})
			var med = adjs.sort(function(n, m){ return n - m })[Math.floor(adjs.length/2)]
			var mad = adjs.map(function(e){ return Math.abs(e - med)}).reduce(function(n, m){ return n + m }) / adjs.length
			// console.log(mad, 'zad flad')
			if(mad < 2) return true;
		}
		return false;
	}).map(function(e){
		if(e.length == 1) return e;

		var adjs = otsu_adjacent([].concat.apply([], e.map(function(f){ return f.lines })).sort(function(l1, l2){ return l1.cy - l2.cy }), function(cur, next){
			return Math.max(0, next.cy - cur.cy)
		})
		var med = adjs.sort(function(n, m){ return n - m })[Math.floor(adjs.length/2)]
		var mad = adjs.map(function(e){ return Math.abs(e - med)}).reduce(function(n, m){ return n + m }) / adjs.length
		
		if(mad < 2){
			// return true;
			return wrap_regions([].concat.apply([], e.map(function(f){ return f.lines })))
		}else{
			return e
		}
	}))

	// function sum(arr){ for(var s = 0, i = 0; i < arr.length; i++) s += arr[i]; return s }

	// function std(arr){
	// 	var mu = sum(arr) / arr.length
	// 	for(var s = 0, i = 0; i < arr.length; i++) s += (arr[i] - mu) * (arr[i] - mu);
	// 	return Math.sqrt(s)
	// }



	// var regions = [].concat.apply([], regions.map(function(col){
	// 	var buffer = []
	// 	var out = []
	// 	var lsd = 1
	// 	lines.sort(function(a, b){ return a.cy - b.cy }).forEach(function(line){
	// 		var everything = buffer.concat(line)
	// 		var adj = otsu_adjacent(everything, function(cur, next){
	// 			return Math.max(next.cy - cur.cy, 0)
	// 		})
	// 		var nsd = Math.max(1, std(adj))
	// 		if(nsd / lsd > 5){
	// 			out.push(wrap_regions(buffer))
	// 			buffer = []
	// 		}
	// 		lsd = nsd
	// 		buffer.push(line)
	// 	})
	// 	return out
	// }));

	// split paragraphs 
	var regions = [].concat.apply([], regions.map(function(col){
		var lines = col.lines;
		// split colums vertically with the otsu threshold for line spacing
		var rows = lines.sort(function(a, b){ return a.cy - b.cy })
		
		var xhs = 0; lines.forEach(function(line){ xhs += line.xheight })
		var mxh = xhs / lines.length;

		// function med_med(line){
		// 	return line.letters.map(function(e){
		// 		return e.cy + e.medy
		// 	}).sort(function(a, b){
		// 		return a - b
		// 	})[Math.floor(line.letters.length / 2)]
		// }
		return otsu_cluster(rows, function(cur, next){
			// return Math.max(0, med_med(next) - med_med(cur))
			return Math.max(0, next.y0 - cur.y1)
			// return Math.max(0, next.cy - cur.cy)
		}, params.col_breakdown).map(wrap_regions)
	}))

	// merge regions that overlap a lot and i mean really a lot
	regions = [].concat.apply([], equivalence_classes(regions, function(a, b){
		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
		if(width > 0 && height > 0 
			&& 
			(width * height > params.col_mergethresh * Math.min(a.area, b.area))
			){
			return true;
		}
		return false;
	}).map(function(group){

	// var blah = document.createElement('canvas')
	// blah.width = Ximage.width
	// blah.height = Ximage.height
	// var ctx = blah.getContext('2d')
	// ctx.drawImage(img_get(Ximage.src), 0, 0, Ximage.width, Ximage.height)
	// ctx.lineWidth = 2;
	// // orphaned_lines.forEach(function(line){
	// // 	ctx.strokeStyle = 'blue'
	// // 	ctx.strokeRect(line.x0, line.y0, line.width, line.height);
		
	// // })
	// group.forEach(function(line){
	// 	ctx.strokeStyle = 'red'
	// 	ctx.strokeRect(line.x0, line.y0, line.width, line.height);
	// })

	// console.image(blah.toDataURL('image/png'))

		// if there are lots of overlaps, then choose the recognized-letter maximizing
		// subset which do not overlap with each other, this is probably something
		// analagous to the knapsack problem which we do not bother actually solving

		// return wrap_regions([].concat.apply([], group.map(function(col){return col.lines})))
		// 
		
		function rotbb(line){
			var hyp = line.width / Math.cos(line.angle)
			return {
				x0: line.cx - hyp / 2,
				y0: line.cy - line.lineheight / 2,
				x1: line.cx + hyp / 2,
				y1: line.cy + line.lineheight / 2
			}
		}

		var avg_ang = 0;
		for(var i = 0; i < group.length; i++)
			avg_ang += group[i].angle / group.length;

		if(Math.abs(avg_ang) > 0.1){
			var lines = [].concat.apply([], group.map(function(col){return col.lines}))
			var sorted = lines.sort(function(b, a){
				return a.lettercount - b.lettercount
			});
			var buffer = []
			for(var i = 0; i < sorted.length; i++){
				var can = sorted[i];
				var intersects = buffer.some(function(line){
					var linebb = rotbb(line),
						canbb = rotbb(can);
						
					var width = Math.min(linebb.x1, canbb.x1) - Math.max(linebb.x0, canbb.x0),
						height = Math.min(linebb.y1, canbb.y1) - Math.max(linebb.y0, canbb.y0);

					return (width > 0 && height > 0)
				})

				if(!intersects) buffer.push(can);
			}
			return wrap_regions([].concat.apply([], group.map(function(col){return col.lines})))
		}else{
			var sorted = group.sort(function(b, a){
				return a.lettercount - b.lettercount
			});
			var buffer = []
			for(var i = 0; i < sorted.length; i++){
				var can = sorted[i];
				var intersects = buffer.some(function(col){
						
					var width = Math.min(col.x1, can.x1) - Math.max(col.x0, can.x0),
						height = Math.min(col.y1, can.y1) - Math.max(col.y0, can.y0);

					var lin_area = (col.x1 - col.x0) * (col.y1 - col.y0)
					var can_area = (can.x1 - can.x0) * (can.y1 - can.y0)
					return (width > 0 && height > 0 && width * width > 0.2 * Math.min(lin_area, can_area))
				})

				if(!intersects) buffer.push(can);
			}
			return buffer
		}

		
		
	}))

	console.timeEnd("find regions")



	console.time("break words")

	function wrap_words(letters){
		var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
		for(var i = 0; i < letters.length; i++){
			var letter = letters[i];
			x0 = Math.min(x0, letter.x0); y0 = Math.min(y0, letter.y0);
			x1 = Math.max(x1, letter.x1); y1 = Math.max(y1, letter.y1);
		}
		return {
			letters: letters,
			x0: x0,
			y0: y0,
			y1: y1,
			x1: x1,
			cx: x0 + (x1 - x0) / 2,
			cy: y0 + (y1 - y0) / 2,
			width: x1 - x0,
			height: y1 - y0,
			area: (x1 - x0) * (y1 - y0)
		}
	}

	// lines = lines.map(function(line){
	// 	var letters = line.letters;
	// 	// maybe we should extract the regions/paragraphs first and then
	// 	// establish the letter spacing variance for teh whole paragraph
	// 	// before creating the threshold
	// 	var words = otsu_cluster(letters, function(cur, next){
	// 		return Math.max(0, next.x0 - cur.x1)
	// 	}, params.breakdown_ratio)
	// 	var new_line = { words: words.map(wrap_words) }
	// 	for(var prop in line) if(prop != 'letters') new_line[prop] = line[prop];
	// 	return new_line
	// })



	regions.map(function(col){
		var adjs = col.lines.map(function(line){
			var ln = otsu_adjacent(line.letters, function(cur, next){
				return Math.max(0, next.x0 - cur.x1)
			})

			// for long lines, ignore the longest one because it's 
			// probably some punctuation that didn't make it through
			// the connected components thresholding
			if(ln.length > 15) {
				var max = ln.map(function(e, i){ return [e, i] })
							.sort(function(b, a){ return a[0] - b[0] });
				ln = ln.map(function(e, i){
					if(i == max[0][1]) return max[1][0];
					return e
				})
			}
			return ln;
		});
		var stats = otsu([].concat.apply([], adjs));

		col.lines = col.lines.map(function(line, index){
			// var stats = otsu([].concat.apply([], adjs[index]));
			var words = linear_cluster(line.letters, adjs[index], params.breakdown_ratio, stats);
			// line.words = words.map(wrap_words)
			// return line
			var new_line = { words: words.map(wrap_words) }
			for(var prop in line) if(prop != 'letters') new_line[prop] = line[prop];
			return new_line
		})

		// col.lines = col.lines.map(function(line, index){
		// 	var trans_dist = otsu_adjacent(line.letters, function(cur, next){ return Math.max(0, next.x0 - cur.x1) })
		// 	var stats = otsu(trans_dist.map(function(e){}));
		// 	var words = linear_cluster(line.letters, trans_dist, params.breakdown_ratio, stats);
		// 	var new_line = { words: words.map(wrap_words) }
		// 	for(var prop in line) if(prop != 'letters') new_line[prop] = line[prop];
		// 	return new_line
		// })




		// col.lines = col.lines.map(function(line, index){
		// 	// var stats = otsu([].concat.apply([], adjs[index]));
		// 	var init_params = [Math.log(4), Math.log(15), Math.log(20)]
		// 	var num_iters = -1000;
		// 	var trans_dist = otsu_adjacent(line.letters, function(cur, next){ return Math.max(0, next.x0 - cur.x1) })
		// 	var thresh = 0;
		// 	try {
		// 		var result = minimize(init_params, poisson_mix, num_iters, trans_dist);	
		// 		thresh = Math.round(Math.exp(result[0][2]));

		// 		console.log('minimized', trans_dist, result)
		// 	}catch(err){
		// 		console.log('could not minimize', trans_dist)
		// 	}



		// 	var words = linear_cluster(line.letters, trans_dist, thresh)
		// 	// var words = linear_cluster(line.letters, adjs[index], params.breakdown_ratio, stats);

		// 	var new_line = { words: words.map(wrap_words) }
		// 	for(var prop in line) if(prop != 'letters') new_line[prop] = line[prop];
		// 	return new_line
		// })		

		


	})
	console.timeEnd("break words")
	return regions
}


// this metric isn't ideal: fix it
function median(data){
	var thresh = 15;
	var range = 256;
	var histogram = [], maxf = 0, maxi = 0;
	for(var i = 0; i < range; i++) histogram[i] = 0;
	for(var i = 0; i < data.length; i++) histogram[data[i]]++;
	
	for(var i = thresh; i < range - thresh; i++){
		var f = 0;
		for(var j = i - thresh; j < i + thresh; j++) f += histogram[j];
		if(f > maxf){
			maxf = f;
			maxi = i;
		}
	}
	return maxi
}

function bias_median(data, dir){
	var thresh = 15;
	var range = 256;
	var histogram = [], maxf = 0, maxi = 0;
	for(var i = 0; i < range; i++) histogram[i] = 0;
	for(var i = 0; i < data.length; i++) histogram[data[i]]++;
	
	for(var i = thresh; i < range - thresh; i++){
		var f = dir * i;
		for(var j = i - thresh; j < i + thresh; j++) f += histogram[j];

		if(f > maxf){
			maxf = f;
			maxi = i;
		}
	}
	return maxi
}

// function real_median(data){
// 	return data.sort(function(a,b){return a - b})[Math.floor(data.length / 2)]
// }

function color_diff(a, b){
	// TODO: take into account the direction of the color search
	// so that we can be biased toward the direction, i.e.
	// if we're on the black on white search mode, colors skewed
	// black are favored more than colors skewed white
	// return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2])

	// return deltaE(rgb2lab(a), rgb2lab(b))

	return Math.sqrt(
			(a[0] - b[0]) * (a[0] - b[0]) + 
			(a[1] - b[1]) * (a[1] - b[1]) +
			(a[2] - b[2]) * (a[2] - b[2]))
}


function dominant_color(tuples, bias_direction){
	var composite = [];
	for(var j = 0; j < tuples[0].length; j++){
		var arr = []
		for(var i = 0; i < tuples.length; i++){
			arr.push(tuples[i][j])
		}
		composite.push(bias_median(arr, bias_direction))	
	}

	return composite
}



function median_color(tuples){
	var composite = [];
	for(var j = 0; j < tuples[0].length; j++){
		var arr = []
		for(var i = 0; i < tuples.length; i++){
			arr.push(tuples[i][j])
		}
		composite.push(median(arr))	
	}

	return composite
}

function otsu_color(tuples){
	var composite = [];
	for(var j = 0; j < tuples[0].length; j++){
		var arr = []
		for(var i = 0; i < tuples.length; i++){
			arr.push(tuples[i][j])
		}
		composite.push(otsu(arr).threshold)
	}
	return composite
}



function thresh_compare(a, thresh, direction){
	if(direction == -1){
		return a[0] < thresh[0] && a[1] < thresh[1] && a[2] < thresh[2] 
	}else if(direction == 1){
		return a[0] > thresh[0] && a[1] > thresh[1] && a[2] > thresh[2] 
	}
}

// use otsu's method in order to break up a serial list into runs
// it's really pretty neat that wikipedia implements
// the algorithm in javascript for simple and easy 
// copy pasta powers

function otsu_cluster(list, adjacent, breakdown){
	// this doesn't work for small things
	if(list.length <= 3) return [list];
	var adj = otsu_adjacent(list, adjacent);
	return linear_cluster(list, adj, breakdown, otsu(adj))
}

function otsu_adjacent(list, adjacent){
	var a = [];
	for(var i = 0; i < list.length - 1; i++){
		var n = Math.max(0, adjacent(list[i], list[i + 1])); // negative histograms are nonsensical
		a.push(n)
	}
	return a;
}

function otsu(a){
	var histogram = [], range = 0, sum = 0;
	for(var i = 0; i < a.length; i++){
		var n = a[i];
		if(n >= range) range = n + 1;
		sum += n;
	}
	// initialize histogram
	for(var i = 0; i < range; i++) histogram[i] = 0;
	for(var i = 0; i < a.length; i++) histogram[a[i]]++;
	var sumB = 0;
	var wB = 0, wF = 0, total = a.length;
	var mB, mF, between;
	var max = 0;
	var threshold = 0;
	for (var i = 0; i < histogram.length; ++i) {
		wB += histogram[i];
		if (wB == 0)
			continue;
		wF = total - wB;
		if (wF == 0)
			break;
		sumB += i * histogram[i];
		mB = sumB / wB;
		mF = (sum - sumB) / wF;
		between = wB * wF * Math.pow(mB - mF, 2);
		if (between > max) {
			max = between;
			threshold = i;
		}
	}
	var std = Math.sqrt(max / total / total),
		mean = sum / a.length;
	return {
		std: std,
		mean: mean,
		threshold: threshold
	}
}

function linear_cluster(list, adj, breakdown, stats){
	// default breakdown parameter is an arbitrary magic number
	if(typeof stats == 'undefined'){
		// breakdown is the threshold
		stats = { std: 1, mean: 0, threshold: breakdown }
		breakdown = 0;
	}else{
		if(typeof breakdown == 'undefined') breakdown = 0.5;	
	}
	
	var output = [];
	if(stats.std > stats.mean * breakdown){
		// console.log('clustring', stats.threshold)
		var nt = [];
		nt.push(list[0]);
		for(var i = 0; i < list.length - 1; i++){
			if(adj[i] > stats.threshold){
				output.push(nt)
				nt = []
			}
			nt.push(list[i + 1])
		}
		output.push(nt)
	}else{
		// console.log('nope', stats, list, breakdown)
		output.push(list)
	}
	return output
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

function mask_telea(src, col, swtscale, swtwidth, cb){
	var xpad = 15;
	var ypad = 15;

	var unscaled = img_cut(src, 1, 
		(col.x0 / swtscale - xpad),
		(col.y0 / swtscale - ypad),
		(col.width / swtscale + xpad * 2),
		(col.height / swtscale + ypad * 2)
	);
	
	var mskscale = 2;
	var img2x = img_cut(src, mskscale, 
		(col.x0 / swtscale - xpad),
		(col.y0 / swtscale - ypad),
		(col.width / swtscale + xpad * 2),
		(col.height / swtscale + ypad * 2)
	);
	// show_image_data(unscaled)
	// console.log('beg telea', unscaled.width, unscaled.height, mask.cols, mask.rows)
	var worker = new Worker(global_params.inpaint_worker)
	worker.onmessage = function(e){
		var data = e.data;
		if(data.visualize){
			console.log('viz')
			// visualize_matrix(data.visualize)
			var mat = data.visualize
				var c = document.createElement('canvas')
				c.width = mat.cols;
				c.height = mat.rows;
				var cx = c.getContext('2d')
				var out = cx.createImageData(mat.cols, mat.rows);
				for(var i = 0; i < mat.rows * mat.cols; i++){

					out.data[i * 4 + 3] = 255
					// if(mat.data[i] == 1){
					// 	out.data[i * 4] = 255
					// }else if(mat.data[i] == 2){
					// 	out.data[i * 4 + 1] = 255
					// }else if(mat.data[i] == 3){
					// 	out.data[i * 4 + 2] = 255
					// }else{
					// 	out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = mat.data[i]
					// }

					// Max[0, Min[1, 2 - Abs[x - 2]]]
					// Plot[Max[0, Min[1, 2 - Abs[Mod[(x - 4), 6] - 2]]], {x, 0, 6}]
					var x = mat.data[i] / 256
					if(x > 0){
						out.data[i * 4] = Math.max(0, Math.min(1, 2 - Math.abs(((4 * Math.min(1, x) + 2) % 6) - 2))) * 255
						out.data[i * 4 + 1] = Math.max(0, Math.min(1, 2 - Math.abs(((4 * Math.min(1, x) + 0) % 6) - 2))) * 255
						out.data[i * 4 + 2] = Math.max(0, Math.min(1, 2 - Math.abs(((4 * Math.min(1, x) + 4) % 6) - 2))) * 255
					}

					
				}
				cx.putImageData(out, 0, 0)
				console.image(c.toDataURL('image/png'))


		}else if(typeof e.data == 'object' && e.data.type == 'out'){
			unscaled.data.set(e.data.image)
			
			cb({
				imageData: unscaled,
				colors: e.data.colors
			})	
		}else{

			console.log(e.data)
		}
		
		// console.log(unscaled)
		// alpha_image_data(unscaled)
	}
	worker.postMessage({
		image: unscaled,
		image2x: img2x,

		region: col,
		swtwidth: swtwidth,
		swtscale: swtscale,
		mskscale: mskscale,
		xpad: xpad,
		ypad: ypad
		// mask: mask,
		// width: unscaled.width,
		// height: unscaled.height,
		// image: unscaled.data,
		// mask: mask.data
	})
}




function queue_paint(data){
	var xpad = 15;
	var ypad = 15;

	mask_telea(data.src, data.region, data.swtscale, data.swtwidth, function(result){
		var dat = result.imageData
		var canvas = document.createElement('canvas')
		canvas.width = dat.width
		canvas.height = dat.height
		canvas.getContext('2d').putImageData(dat, 0, 0)
		// console.image(canvas.toDataURL('image/png'))
		// alpha_image_data(dat)

		broadcast({
			type: 'painted',
			plaster: canvas.toDataURL('image/png'),
			id: data.id,
			reg_id: data.reg_id,
			x: Math.round(data.region.x0 / data.swtscale - xpad),
			y: Math.round(data.region.y0 / data.swtscale - ypad),
			colors: result.colors,
			width: dat.width,
			height: dat.height
		})
	})
}


function mask_region(src, col, mskscale, swtscale, swtwidth, xpad, ypad, cb){
	
	var dat = img_cut(src, mskscale, 
		(col.x0 / swtscale - xpad),
		(col.y0 / swtscale - ypad),
		(col.width / swtscale + xpad * 2),
		(col.height / swtscale + ypad * 2)
	);

	var worker = new Worker(global_params.mask_worker)
	// console.log('generated dat')
	worker.onmessage = function(e){
		var data = e.data;
		if(data.visualize){
			console.log('viz')
			// visualize_matrix(data.visualize)
			var mat = data.visualize
				var c = document.createElement('canvas')
				c.width = mat.cols;
				c.height = mat.rows;
				var cx = c.getContext('2d')
				var out = cx.createImageData(mat.cols, mat.rows);
				for(var i = 0; i < mat.rows * mat.cols; i++){

					out.data[i * 4 + 3] = 255
					// if(mat.data[i] == 1){
					// 	out.data[i * 4] = 255
					// }else if(mat.data[i] == 2){
					// 	out.data[i * 4 + 1] = 255
					// }else if(mat.data[i] == 3){
					// 	out.data[i * 4 + 2] = 255
					// }else{
					// 	out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = mat.data[i]
					// }

					// Max[0, Min[1, 2 - Abs[x - 2]]]
					// Plot[Max[0, Min[1, 2 - Abs[Mod[(x - 4), 6] - 2]]], {x, 0, 6}]
					var x = mat.data[i] / 256
					if(x > 0){
						out.data[i * 4] = Math.max(0, Math.min(1, 2 - Math.abs(((4 * Math.min(1, x) + 2) % 6) - 2))) * 255
						out.data[i * 4 + 1] = Math.max(0, Math.min(1, 2 - Math.abs(((4 * Math.min(1, x) + 0) % 6) - 2))) * 255
						out.data[i * 4 + 2] = Math.max(0, Math.min(1, 2 - Math.abs(((4 * Math.min(1, x) + 4) % 6) - 2))) * 255
					}

					
				}
				cx.putImageData(out, 0, 0)
				console.image(c.toDataURL('image/png'))


		}else if(data.intoct){

			var merp = document.createElement('canvas')
			merp.width = 256
			merp.height = 256
			document.body.appendChild(merp)
			merp = merp.getContext('2d')
			merp.beginPath()
			merp.strokeStyle = '#e0e0e0'
			for(var i = 0; i < 256 * 2; i+=5){
				merp.moveTo(0, i)
				merp.lineTo(i, 0)
			}
			merp.stroke()
			// for(var color = 0; color < data.intoct.length; color++){
			for(var i = 0; i < data.contour.length; i++){
				var color = data.contour[i];

				var nl = ((color     ) & 15) << 4,
					na = ((color >> 4) & 15) << 4,
					nb = ((color >> 8)     ) << 4;

				var l = (nl - 40),
					a = (na - 128),
					b = (nb - 128);

				if(data.intoct[color] > 0){
					// var rgb = data.invmap[color]
					var rgb = lab2rgb([l, a, b]).map(Math.round)
					// console.log(rgb, rgb2, rgb2lab(rgb2), [l, a, b])
					merp.strokeStyle = 'rgb(' + rgb.join(',') + ')'
					merp.fillStyle = 'rgb(' + rgb.join(',') + ')'

					if(data.intoct[color] / (1 + data.extoct[color]) > 1){
						// merp.lineWidth = Math.min(8, 800000 / data.intoct[color])
						// merp.strokeRect(nl + merp.lineWidth, nb + merp.lineWidth, 16 - 2 * merp.lineWidth, 16 - 2 * merp.lineWidth)
						merp.fillRect(nl, nb, 16, 16)
						// merp.fillRect(nl, na, Math.sqrt(data.intoct[color]) / 10, 16)
					}else{
						
						merp.lineWidth = 3
						merp.strokeRect(nl + merp.lineWidth, nb + merp.lineWidth, 16 - 2 * merp.lineWidth, 16 - 2 * merp.lineWidth)
					}	
				}
				
			}
			console.image(merp.canvas.toDataURL('image/png'), data.log)
			
		}else if(data.log){
			console.log(data.log)
		}else{
			worker.terminate()
			cb(data)
		}
		// console.log('got message')
		
		// var msg = e.data;
		// visualize_matrix(msg)

		// visualize_matrix(halve_dilation(msg))

		// mask_telea(src, col, halve_dilation(single_dilation(msg)), swtscale)

	}
	// this sheer number of arguments is actually
	// quite literally disgusting
	worker.postMessage({
		action: 'mask',
		imageData: dat,
		region: col,
		swtwidth: swtwidth,
		swtscale: swtscale,
		mskscale: mskscale,
		xpad: xpad,
		ypad: ypad
	})
}

/*
 * JavaScript Canvas to Blob 2.0.5
 * https://github.com/blueimp/JavaScript-Canvas-to-Blob
 *
 * Copyright 2012, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 *
 * Based on stackoverflow user Stoive's code snippet:
 * http://stackoverflow.com/q/4998908
 */

/*jslint nomen: true, regexp: true */
/*global window, atob, Blob, ArrayBuffer, Uint8Array, define */

(function (window) {
    'use strict';

    var CanvasPrototype = window.HTMLCanvasElement &&
            window.HTMLCanvasElement.prototype,
        hasBlobConstructor = window.Blob && (function () {
            try {
                return Boolean(new Blob());
            } catch (e) {
                return false;
            }
        }()),
        hasArrayBufferViewSupport = hasBlobConstructor && window.Uint8Array &&
            (function () {
                try {
                    return new Blob([new Uint8Array(100)]).size === 100;
                } catch (e) {
                    return false;
                }
            }()),
        BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder ||
            window.MozBlobBuilder || window.MSBlobBuilder,
        dataURLtoBlob = (hasBlobConstructor || BlobBuilder) && window.atob &&
            window.ArrayBuffer && window.Uint8Array && function (dataURI) {
                var byteString,
                    arrayBuffer,
                    intArray,
                    i,
                    mimeString,
                    bb;
                if (dataURI.split(',')[0].indexOf('base64') >= 0) {
                    // Convert base64 to raw binary data held in a string:
                    byteString = atob(dataURI.split(',')[1]);
                } else {
                    // Convert base64/URLEncoded data component to raw binary data:
                    byteString = decodeURIComponent(dataURI.split(',')[1]);
                }
                // Write the bytes of the string to an ArrayBuffer:
                arrayBuffer = new ArrayBuffer(byteString.length);
                intArray = new Uint8Array(arrayBuffer);
                for (i = 0; i < byteString.length; i += 1) {
                    intArray[i] = byteString.charCodeAt(i);
                }
                // Separate out the mime component:
                mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
                // Write the ArrayBuffer (or ArrayBufferView) to a blob:
                if (hasBlobConstructor) {
                    return new Blob(
                        [hasArrayBufferViewSupport ? intArray : arrayBuffer],
                        {type: mimeString}
                    );
                }
                bb = new BlobBuilder();
                bb.append(arrayBuffer);
                return bb.getBlob(mimeString);
            };
    if (window.HTMLCanvasElement && !CanvasPrototype.toBlob) {
        if (CanvasPrototype.mozGetAsFile) {
            CanvasPrototype.toBlob = function (callback, type, quality) {
                if (quality && CanvasPrototype.toDataURL && dataURLtoBlob) {
                    var that = this;
                    setTimeout(function(){
                        callback(dataURLtoBlob(that.toDataURL(type, quality)));
                    }, 0)
                } else {
                    callback(this.mozGetAsFile('blob', type));
                }
            };
        } else if (CanvasPrototype.toDataURL && dataURLtoBlob) {
            CanvasPrototype.toBlob = function (callback, type, quality) {
                var that = this;
                setTimeout(function(){
                    callback(dataURLtoBlob(that.toDataURL(type, quality)));    
                }, 0)
            };
        }
    }
    if (typeof define === 'function' && define.amd) {
        define(function () {
            return dataURLtoBlob;
        });
    } else {
        window.dataURLtoBlob = dataURLtoBlob;
    }
}(this));
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