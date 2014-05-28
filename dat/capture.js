var multiparty = require('multiparty'), 
	http = require('http'),
	fs   = require('fs'),
	util = require('util');

http.createServer(function(req, res) {

	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.setHeader('Access-Control-Max-Age', '604800');
	// is this a security problem?
	if(req.headers['access-control-request-headers']){
		res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'])	
	}
		
	
	var form = new multiparty.Form();
	form.parse(req, function(err, fields, files) {
		if (req.url === '/plaster' && req.method === 'POST') {
			console.log('mkdir ', fields.id)
			fs.mkdir(fields.id.join(''), function(){
				fs.rename(files.image[0].path, fields.id.join('') + '/' + fields.region.join('').replace(/[\:\-]/g, '') + '.png')
			})
			console.log(files, fields)
		} else if (req.url === '/save' && req.method === 'POST') {
			fs.mkdir(fields.id.join(''), function(){
				// fs.rename(files.image[0].path, fields.id.join('') + '/' + fields.region.join('').replace(/[\:\-]/g, '') + '.png')
				fs.writeFile(fields.id.join('') + '/regions.json', fields.content.join(''), function(){
					console.log('saved' + fields.id)
				})
			})
		}
	});
	
	// show a file upload form
	res.writeHead(200, {'content-type': 'text/html'});
	res.end(
		"<link href='http://fonts.googleapis.com/css?family=Source+Sans+Pro:200,600' rel='stylesheet' type='text/css'>" +
		'<style>*{font-family: \'Source Sans Pro\', sans-serif;margin: 0;font-weight: 200; text-align: center}</style>' +
		'<h1 style="margin-top: 100px">The answer is <font color=orange>42</font></h1>'
	);
}).listen(4242);
