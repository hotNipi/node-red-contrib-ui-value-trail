/*
MIT License

Copyright (c) 2019 hotNipi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

module.exports = function (RED) {
	function HTML(config) {			
		var layout = String.raw`		
			<svg preserveAspectRatio="xMidYMid meet" id="vatra_svg_{{unique}}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
				<defs>
					<filter id="dropShadow_{{unique}}">
						<feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur1" />
						<feFlood flood-color=`+config.color+` result="color"/>
						<feComposite in="color" in2="blur1" operator="in" result="sombra" />
							<feOffset dx="0" dy="0" />
							<feMerge>
								<feMergeNode />
								<feMergeNode in="SourceGraphic" />
							</feMerge>
					</filter>				
				</defs>	
				<polyline ng-if="${config.blur == true}" id="vatra_line_{{unique}}" points="0,0 0,0" style="fill:none;stroke:`+config.color+`;stroke-width:`+config.stroke+`" filter="url(#dropShadow_{{unique}})"/>
				<polyline ng-if="${config.blur == false}" id="vatra_line_{{unique}}" points="0,0 0,0" style="fill:none;stroke:`+config.color+`;stroke-width:`+config.stroke+`"/>	
			</svg>`			
		
		return String.raw`${layout}`;
	}

	function checkConfig(node, conf) {
		if (!conf || !conf.hasOwnProperty("group")) {
			node.error(RED._("ui_valuetrail.error.no-group"));
			return false;
		}
		return true;
	}

	var ui = undefined;

	function ValueTrailNode(config) {
		try {
			var node = this;			
			if (ui === undefined) {
				ui = RED.require("node-red-dashboard")(RED);
			}			
			RED.nodes.createNode(this, config);			
			var done = null;
			var range = null;
			var site = null;		
			var ensureNumber = null;
			var getSiteProperties = null;
			var getPosition = null;
			var getCount = null;
			var createPoints = null;
			var formatPoints = null;
			var recalculate = null;			
			if (checkConfig(node, config)) {				
				ensureNumber = function (input) {
					if (input === undefined) {
						return config.min;
					}
					if (typeof input !== "number") {
						var inputString = input.toString();
						input =  parseFloat(inputString)
						if(isNaN(input)){
							node.warn("msg.payload does not contain numeric value")
							return config.min
						}						
					}
					if(isNaN(input)){
						node.warn("msg.payload does not contain numeric value")
						input = config.min;
					}					
					return input;
				}
				getSiteProperties = function(){
					var opts = null;					
					if (typeof ui.getSizes === "function") {			
						opts = {};
						opts.sizes = ui.getSizes();
						opts.theme = ui.getTheme();
					}	
					if(opts === null){
						node.log("Couldn't reach to the site parameters. Using hardcoded default parameters!")
						opts = {}
						opts.sizes = { sx: 48, sy: 48, gx: 4, gy: 4, cx: 4, cy: 4, px: 4, py: 4 }
						opts.theme = {'widget-backgroundColor':{value:"#097479"}}						
					}									
					return opts
				}
				range = function (n,p,r){					
					var divisor = p.maxin - p.minin;							
					n = n > p.maxin ? p.maxin - 0.00001 : n;
					n = n < p.minin ? p.minin : n;
					n = ((n - p.minin) % divisor + divisor) % divisor + p.minin;
					n = ((n - p.minin) / (p.maxin - p.minin) * (p.maxout - p.minout)) + p.minout;										
					if(!r){
						return Math.round(n);
					}				
					return n					
				}	
				getPosition = function(target,min,max){
					var p =  {minin:min, maxin:max+0.00001, minout:config.exactheight, maxout:1}
					return range(target,p,true)
				}
				
				getCount = function(){				
					return parseInt(config.width* config.pointcount)
				}				
				createPoints = function(){
					var pt = ""				
					var podata = []
					var val = []
					var step = config.exactwidth / config.count					
					var y = parseInt(config.exactheight/2)
					for (var i = 0; i < config.count; i++) {												
						pt += step * i+','+y+' '
						val.push(0)
						podata.push(y)
					}
					return {values:val,calculated:podata,formatted:pt}
				}				
				formatPoints = function (p){
					var pt = ""
					var step = config.exactwidth / config.count	
					for (var i = 0; i < config.count; i++) {												
						pt += step * i+','+p[i]+' '						
					}
					return pt
				}				
				recalculate = function(){					
					for (var i = 0; i < config.count; i++) {
						config.points.calculated[i] = getPosition(config.points.values[i],config.min,config.max)
					}					
				}				
				var group = RED.nodes.getNode(config.group);
				var site = getSiteProperties();				
				if(config.width == 0){ config.width = parseInt(group.config.width) || 1}
				if(config.height == 0) {config.height = parseInt(group.config.height) || 1}
				config.width = parseInt(config.width)
				config.height = parseInt(config.height)
				config.exactwidth = parseInt(site.sizes.sx * config.width + site.sizes.cx * (config.width-1)) - 12;		
				config.exactheight = parseInt(site.sizes.sy * config.height + site.sizes.cy * (config.height-1)) - 12;
				config.count = getCount()
				config.points = createPoints()				
				config.color = site.theme['widget-backgroundColor'].value				
				if(config.colorFromTheme == false){
					config.color = config.colorLine
				}				
				config.min = Number.MAX_VALUE
				config.max = Number.MIN_VALUE				
				var html = HTML(config);		
				
				done = ui.addWidget({
					node: node,
					order: config.order, 
					group: config.group,
					width: config.width,
					height: config.height,									
					format: html,					
					templateScope: "local",
					emitOnlyNewValues: false,
					forwardInputMessages: true,
					storeFrontEndInputAsState: true,				
					
					beforeEmit: function (msg) {
						if(msg.payload === undefined){
							return 
						}
						if(!config.points || !config.points.values){
							return
						}	
						var fem = {}			
						var valid = true
												
						msg.payload = ensureNumber(msg.payload)
												
						if(config.max < msg.payload){
							config.max = msg.payload
							valid = false							
						}
						if(config.min > msg.payload){
							config.min = msg.payload
							valid = false							
						}
						if(valid == true){
							var current = Math.max(...config.points.values)
							if(config.max > current){
								config.max = current
								valid = false
							}
							current = Math.min(...config.points.values)
							if(config.min < current){
								config.min = current
								valid = false
							}							
						}						
						if(valid == false){
							recalculate()
						}					
						config.points.values.push(msg.payload)
						config.points.values.shift()											
						config.points.calculated.push(getPosition(msg.payload,config.min,config.max))
						config.points.calculated.shift()						
						config.points.formatted = formatPoints(config.points.calculated)
						
						fem.payload = config.points.formatted									
						
						return { msg: fem };
					},
					
					initController: function ($scope) {																		
						$scope.unique = $scope.$eval('$id')				
						
						var updateLine = function (p){
							var line = document.getElementById("vatra_line_"+$scope.unique);
							if(line){
								line.setAttributeNS(null, 'points', p);
							}	
						}								
						$scope.$watch('msg', function (msg) {
							if (!msg) {								
								return;
							}
							if(msg.payload){							
								updateLine(msg.payload)	
							}						
																			
						});
						
					}
				});
			}
		}
		catch (e) {
			console.log(e);
		}
		node.on("close", function () {
			if (done) {
				done();
			}
		});
	}
	RED.nodes.registerType("ui_valuetrail", ValueTrailNode);
};