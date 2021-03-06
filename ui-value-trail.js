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
		
		var params = JSON.stringify({minmax:config.minmax,padding:config.padding,decimals:config.decimals,unit:config.unit,allowtoggle:config.allowtoggle});
		var vis = config.minmax == true ? 'visible' : 'hidden'
		var min = config.min == Number.MAX_SAFE_INTEGER ? 0 : config.min
		var max = config.max == Number.MIN_SAFE_INTEGER ? 0 : config.max

		var styles = String.raw`
		<style>
			.vatra-txt-{{unique}} {					
				fill: currentColor;	
				font-size:${config.height > 4 ? 4 : config.height}em;
				font-weight:bold;
			}					
			.vatra-txt-{{unique}}.small{
				font-size:0.6em;
			}
			.vatra-svg-{{unique}}{
				outline: none;
				border: 0;
				width: 100%;
				height: 100%;
			}			
		</style>`	
		
		var layout = String.raw`		
			<svg preserveAspectRatio="xMidYMid meet" id="vatra_svg_{{unique}}" xmlns="http://www.w3.org/2000/svg" ng-click='toggle()' ng-init='init(`+params+`)' class="vatra-svg-{{unique}}">
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
				<text id=vatra_max_{{unique}} class="vatra-txt-{{unique}} small" text-anchor="start" dominant-baseline="hanging" x="0" y="0" visibility="${vis}">${max}</text>					
				<text id=vatra_min_{{unique}} class="vatra-txt-{{unique}} small" text-anchor="start" dominant-baseline="baseline" x="0" y="100%"  visibility="${vis}">${min}</text>	
				<text ng-if="${config.showvalue == true}" id=vatra_val_{{unique}} class="vatra-txt-{{unique}}" text-anchor="middle" dominant-baseline="baseline" x="50%" y="70%" ></text>
			</svg>`			
		
		return String.raw`${styles}${layout}`;
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
			var getLimits = null;		
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
					var opts = {}
					opts.sizes = { sx: 48, sy: 48, gx: 4, gy: 4, cx: 4, cy: 4, px: 4, py: 4 }
					opts.theme = {'widget-backgroundColor':{value:"#097479"}}						
					if (typeof ui.getSizes === "function") {			
						if(ui.getSizes()){
							opts.sizes = ui.getSizes();
						}
						if(ui.getTheme()){
							opts.theme = ui.getTheme();
						}
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
					if(min == max){
						return (config.exactheight/2)+4
					}
					var p =  {minin:min, maxin:max+0.00001, minout:config.exactheight, maxout:1}
					return range(target,p,true)
				}
				
				getCount = function(){				
					return parseInt(config.width* config.pointcount)
				}
				getLimits = function(){					
					var mi = config.min
					var ma = config.max
					if(mi === Number.MAX_SAFE_INTEGER){
						mi = 0
					}
					if(ma === Number.MIN_SAFE_INTEGER){
						ma = 0
					}
					return {min:mi,max:ma}
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
				config.min = Number.MAX_SAFE_INTEGER 
				config.max = Number.MIN_SAFE_INTEGER
				config.property = config.property || "payload";
				config.decimals = config.decimals || 0
				config.unit = config.unit || ""
				config.padding = {
					hor:'6px',
					vert:(site.sizes.sy/16)+'px'
				}	
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
						if(!config.points || !config.points.values){
							return
						}	
						var fem = {}			
						var valid = true
						var val = RED.util.getMessageProperty(msg, config.property);						
						val = ensureNumber(val)
												
						if(config.max < val){
							config.max = val
							valid = false							
						}
						if(config.min > val){
							config.min = val
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
						config.points.values.push(val)
						config.points.values.shift()											
						config.points.calculated.push(getPosition(val,config.min,config.max))
						config.points.calculated.shift()						
						config.points.formatted = formatPoints(config.points.calculated)
						
						fem.payload = {points:config.points.formatted,limits:getLimits(),val:val}								
						
						return { msg: fem };
					},
					
					initController: function ($scope) {																		
						$scope.unique = $scope.$eval('$id')
						$scope.waitingmessage = null;
						$scope.inited = false
						$scope.togglevalue = 'hiden'
						$scope.lastlimits = {min:0,max:0}
						$scope.switch = false
						$scope.padding = null
						$scope.allowtoggle = true

						$scope.d = 0
						$scope.u = ''
						
						$scope.init = function(params){
							//console.log(params)
							$scope.togglevalue = params.minmax == false ? 'hidden' : 'visible'
							$scope.padding = params.padding							
							$scope.d = params.decimals
							$scope.u = params.unit
							$scope.allowtoggle = params.allowtoggle
							updateContainerStyle()
						}
						
						$scope.toggle = function(){	
							if($scope.allowtoggle == false){
								return
							}						
							$scope.togglevalue = $scope.togglevalue == 'visible' ? 'hidden' : 'visible'
							toggleMinMax()
						}

						var updateContainerStyle = function(){
							var el = document.getElementById("vatra_svg_"+$scope.unique);							
							if(!el){
								setTimeout(updateContainerStyle,40)
								return
							}
							$scope.inited = true	
							el = el.parentElement					
							if(el && el.classList.contains('nr-dashboard-template')){
								if($(el).css('paddingLeft') == '0px'){
									el.style.paddingLeft = el.style.paddingRight = $scope.padding.hor
									el.style.paddingTop = el.style.paddingBottom = $scope.padding.vert
								}
							}
							if($scope.waitingmessage != null){
								var m = {}
								Object.assign(m, $scope.waitingmessage)
								$scope.waitingmessage = null
								update(m)
							}							
						}
						
						var toggleMinMax = function () {
							var tick = document.getElementById("vatra_max_"+$scope.unique);
							if(tick){							
								$(tick).attr('visibility',$scope.togglevalue)
							}
							tick = document.getElementById("vatra_min_"+$scope.unique);
							if(tick){								
								$(tick).attr('visibility',$scope.togglevalue)
							}		
						}
						
						var updateLine = function (p){
							var line = document.getElementById("vatra_line_"+$scope.unique);
							if(line){
								line.setAttributeNS(null, 'points', p);
							}	
						}
						
						var updateLimits = function (limits){					
							$scope.lastlimits = limits							
							var tick = document.getElementById("vatra_max_"+$scope.unique);
							if(tick){								
								$(tick).text(parseFloat($scope.lastlimits.max.toFixed($scope.d)));
							}
							tick = document.getElementById("vatra_min_"+$scope.unique);
							if(tick){								
								$(tick).text(parseFloat($scope.lastlimits.min.toFixed($scope.d)));
							}							
					    }
					    var updateValue = function (v){												
							var va = document.getElementById("vatra_val_"+$scope.unique);
							if(va){								
								$(va).text(parseFloat(v.toFixed($scope.d))+$scope.u);
							}												
						}
						   
						var update = function(m){
							updateLine(m.payload.points)
							updateLimits(m.payload.limits)
							updateValue(m.payload.val)
						}   
														
						$scope.$watch('msg', function (msg) {
							if (!msg) {								
								return;
							}
							if ($scope.inited == false) {
								if($scope.waitingmessage == null){
									$scope.waitingmessage = msg
								}								
								return
							}
							update(msg)
							
																									
						});
						$scope.$on('$destroy', function() {
							$scope.lastlimits = {min:0,max:0}
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