"use strict";

var knobUtils = function(){
	function getAngle(element){
		var st=window.getComputedStyle(element);		

		var tr = st.getPropertyValue("-webkit-transform") ||
        st.getPropertyValue("-moz-transform") ||
        st.getPropertyValue("transform");

		if(!tr||tr=='none') return 0;

		var values = tr.split('(')[1].split(')')[0].split(',');
		var a = values[0];
		var b = values[1];

		var scale = Math.sqrt(a*a + b*b);
		var sin = b/scale;
		var angle = Math.round(Math.atan2(b, a) * (180/Math.PI));
		return angle;
	}

	var setKnobTimings= function(time){
		var knobs = document.querySelectorAll('.knob > .body');

		[].forEach.call(knobs, function(each){
			each.style.transitionDuration="." + time + "s";
		});
	}

	function turnKnob(knob, callback){
		var prevPosition,
		currPosition=getAngle(knob);

		if(callback) callback(currPosition);

		var knobInit = function(event) {
			event.preventDefault();
			var turnStart;

			prevPosition=getAngle(knob);
			
			if(event.touches) turnStart= event.changedTouches[0].clientY;
			else turnStart=event.clientY;

			var knobTurn=function(event){
				event.preventDefault();
				if(event.touches) currPosition=prevPosition - event.changedTouches[0].clientY + turnStart;
				else currPosition=prevPosition - event.clientY + turnStart;

				if(currPosition>-151&&currPosition<151)	{
					knob.style.webkitTransform = 'rotate(' +currPosition + 'deg)'; 
				    knob.style.mozTransform = 'rotate(' + currPosition + 'deg)';
				    knob.style.transform = 'rotate(' + currPosition + 'deg)';
					callback(currPosition);
				}
			}

			document.addEventListener('mousemove', knobTurn);
			document.addEventListener('touchmove', knobTurn);

			document.addEventListener("mouseup", function(event){
				document.removeEventListener("mousemove", knobTurn);
			});	

			document.addEventListener("touchend", function(event){
				document.removeEventListener("touchmove", knobTurn);
			});					
		}

		knob.addEventListener("mousedown", knobInit);
		knob.addEventListener("touchstart", knobInit);
		return currPosition;
	}

	function setKnob(knob, turnValue, callback){
		knob.style.webkitTransform = 'rotate(' +turnValue + 'deg)'; 
	    knob.style.mozTransform = 'rotate(' + turnValue + 'deg)';
	    knob.style.transform = 'rotate(' + turnValue + 'deg)';
		callback(turnValue);
		return turnValue;
	}

	//linear scaling of knob position in degrees, 0 being straight up; 'amp' represents amplitude
	function linScale(knobPosition, amp){
		return amp*(knobPosition + 150)/300;
	}

	//exponential scaling. curve shape represents 'severity' of curve
	function expScale(knobPosition, amp, curveShape){
		return amp*(Math.exp(curveShape*(knobPosition + 150)/300)-1)/(Math.exp(curveShape)-1);
	}

	return {
		turnKnob:turnKnob,
		setKnob:setKnob,
		setKnobTimings:setKnobTimings,
		linScale:linScale,
		expScale:expScale
	}
}();

var switches = function(){
	var pSwitch=document.getElementById("powerSwitch"),
	vSwitch=document.getElementsByClassName("pushswitch");

	var powerSwitch = function() { 
		var powerOn=true;

		var flipSwitch = function(event) {
			event.preventDefault();
			self=this;
			self.classList.toggle('on');

			if(self.classList.contains("on")){ 
				powerOn=true;
				[].forEach.call(vSwitch, function(each, idx){
					if((each).classList.contains('pushed')) {
						each.classList.add('on');
						swarmSynth.voices[idx].voiceOn();
					}
				});
			}
			else { 
				powerOn=false;
				[].forEach.call(vSwitch, function(each, idx){
					each.classList.remove('on');
					swarmSynth.voices[idx].voiceOff();
				});

				swarmSynth.resetEnvelopes();
			}
		}

		pSwitch.addEventListener("click", flipSwitch);
		pSwitch.addEventListener('touchstart', flipSwitch);
	}();

	//toggle individual voices on or off
	var voices=function(){	

		var pushSwitch=function(event){
			event.preventDefault();
			this.classList.toggle("on");
			this.classList.toggle("pushed");
			
			if(this.classList.contains("on")) swarmSynth.voices[this.idx].voiceOn();
			else swarmSynth.voices[this.idx].voiceOff();
		}

		for(var i=0;i<vSwitch.length;i++){
			vSwitch[i].idx=i;
			vSwitch[i].addEventListener("click", pushSwitch);
			vSwitch[i].addEventListener("touchstart", pushSwitch);
		};
	}();
}();

var envController = function(){
	var env=swarmSynth.envSettings;

	var levelShape=4;
	var timeShape=3;

	var scaleEnvTime = function(knobPosition) {
		var scaledEnv=knobUtils.expScale(knobPosition, 3, 3);
		return scaledEnv;				
	}

	var scaleEnvLevel = function(knobPosition) {
		var scaledEnv=knobUtils.expScale(knobPosition, 3, 4);
		return scaledEnv;				
	}

	var settings = {
		setAttack: function(knobPosition){
			env.attackTime=scaleEnvTime(knobPosition)
		},
		setDecay:function (knobPosition){
			env.decayTime=scaleEnvTime(knobPosition);
		},
		setSustain: function (knobPosition){
			env.sustainLevel=scaleEnvLevel(knobPosition);
		},
		setRelease: function (knobPosition){
			env.releaseTime=scaleEnvTime(knobPosition);
		}
	}
	return settings;
}();

var setVolume = function(knobPosition){
	var levelShape=6;
	var scaledVolume=knobUtils.expScale(knobPosition, 1, 6);
	swarmSynth.setVolume(scaledVolume);
}

var setDrive=function(knobPosition){
	var scaledDrive=(knobPosition + 150);
	swarmSynth.setDrive(scaledDrive);
}

var filterController = function(){
	var knobCut=0, 
	ribbonCut=0,
	ribbonTrack;

	//trickery to combine cutoff set by knob and the cutoff value from ribbon tracking
	var setCutoff = function(){
		var controlVal=knobCut + ribbonCut;
		var cutoff=156*Math.pow(2, controlVal);
		swarmSynth.setCutoff(cutoff);
	}

	var settings = {
		setTrack: function(knobPosition){
			ribbonTrack=knobUtils.linScale(knobPosition, 1);
		},

		cutoffKnob: function(knobPosition){
			knobCut= knobUtils.linScale(knobPosition, 6);
			setCutoff();
		},

		ribbonTrack: function(ribPos){
			ribbonCut=ribbonTrack*ribPos/166.7;
			setCutoff();
		},

		setResonance: function(knobPosition){
			var scaledResonance= knobUtils.linScale(knobPosition, 60)
			swarmSynth.setRes(scaledResonance);
		},

		setEnv: function(knobPosition){
			var scaledFilterEnv=knobUtils.linScale(knobPosition, 1);
			swarmSynth.envSettings.filterEnv=scaledFilterEnv;
		}
	}
	return settings;
}();

var setPanelKnobs=function(knobs){
	var knob,init;

	var panelKnobs=[{
			id:'vol',
			turnValue:90,
			callback:setVolume
		},
		{
			id:'cutoff',
			turnValue:45,
			callback:filterController.cutoffKnob
		},
		{
			id:'track',
			turnValue:-20,
			callback:filterController.setTrack
		},
		{
			id:'env',
			turnValue:-50,
			callback:filterController.setEnv
		},
		{
			id:'res',
			turnValue:-120,
			callback:filterController.setResonance
		},
		{
			id:'attack',
			turnValue:-140,
			callback:envController.setAttack
		},
		{
			id:'decay',
			turnValue:-90,
			callback:envController.setDecay
		},
		{
			id:'sustain',
			turnValue:10,
			callback:envController.setSustain
		},
		{
			id:'release',
			turnValue:50,
			callback:envController.setRelease
		},
		{
			id:'drive',
			turnValue:-150,
			callback:setDrive
		}
	];

	if(!knobs){
		knobs=panelKnobs;
		init=true;				
	} else  knobUtils.setKnobTimings(0.5);
	
	for(var i=0; i<knobs.length;i++){
		knob=document.querySelector('#' + panelKnobs[i].id  + ' > .body');
		if(init) knobUtils.turnKnob(knob, panelKnobs[i].callback);		
		knobUtils.setKnob(knob, panelKnobs[i].turnValue, panelKnobs[i].callback);
	}
	knobUtils.setKnobTimings(0);
}();

var ribbonController = function(){
	var startup;

	var ribbon1=document.getElementById("ribbon1");
	var ribbon1Offset=parseInt(ribbon1.getBoundingClientRect().left);

	var ribbon2=document.getElementById("ribbon2");
	var ribbon2Offset=parseInt(ribbon2.getBoundingClientRect().left);

	var swarmRibMargin=10;
    var cluster = [];
    var centerTone;
    var centerNote;
    var swarmInterval=.1;

    var pitchRibbonScale=1000/ribbon1.getBoundingClientRect().width;
    var swarmRibbonScale=125/ribbon2.getBoundingClientRect().width;

    var voiceGate=swarmSynth.volEnvelope;
	var filterGate=swarmSynth.filterEnvelope;
    
    function noteToTone(note) {
    	return 16.35*Math.pow(2, (note/125));
    } 
    
    //this array is a cluster of 8 voice frequencies
    function makeCluster(note){
    	var tone;
    	var toneCeiling=1150;
    	cluster=[];
    	for(var i=0;i<8;i++){
    		tone=note + (i-3.5)*swarmInterval;
    		if(tone>=toneCeiling) tone=toneCeiling;
    		cluster.push(noteToTone(tone));	
    	}
    	return(cluster);
    }

    function sendTone(event){
        event.preventDefault();
        if(event.touches) {
        	if(checkRibbonBoundaries(event.changedTouches[0])) {
        		ribbon1.removeEventListener("touchmove", sendTone);
		        voiceGate(0);
		        filterGate(0);
		        return;
        	}
        	centerNote=(event.changedTouches[0].clientX - ribbon1Offset)*pitchRibbonScale;
        }
    	else centerNote=(event.clientX - ribbon1Offset)*pitchRibbonScale;
    	
        if(!startup) startup = swarmSynth.startVoices();

        swarmSynth.setPitches(makeCluster(centerNote));
        filterController.ribbonTrack(centerNote);
    }

    function swarmTone(event){
    	event.preventDefault();


    	if(event.touches) {
    		if(checkRibbonBoundaries(event.changedTouches[0])) {
        		ribbon2.removeEventListener("touchmove", swarmTone);
		        return;
        	}
    		swarmInterval=(event.changedTouches[0].clientX-ribbon2Offset-swarmRibMargin)*swarmRibbonScale;
    		// console.log(event.touches.length);
    	}	
    	else swarmInterval=(event.clientX-ribbon2Offset-swarmRibMargin)*swarmRibbonScale;
    	
    	swarmSynth.setPitches(makeCluster(centerNote));
    }

    function checkRibbonBoundaries(evt) {
		var xpos=evt.clientX,
		ypos=evt.clientY,
		bound=evt.target.getBoundingClientRect();

		if(xpos < bound.left || 
			xpos > bound.right||
			ypos < bound.top ||
			ypos > bound.bottom) {

			return true;
		}
		else return false;
	}


    var ribbon1Down=function(event){
    	sendTone(event);	            
        voiceGate(1);
        filterGate(1);
    }

    ribbon1.addEventListener("mousedown", function(event) {
        ribbon1Down(event);
        ribbon1.addEventListener("mousemove", sendTone);
    });

    ribbon1.addEventListener("mouseup",function(event) {
        ribbon1.removeEventListener("mousemove", sendTone);
        voiceGate(0);
        filterGate(0);
    });

    ribbon1.addEventListener("mouseleave",function(event) {
        ribbon1.removeEventListener("mousemove", sendTone);
        voiceGate(0);
        filterGate(0);
    });

    ribbon1.addEventListener("touchstart", function(event) {
        ribbon1Down(event);
        ribbon1.addEventListener("touchmove", sendTone);
    });

    ribbon1.addEventListener("touchend",function(event) {
        ribbon1.removeEventListener("touchmove", sendTone);
        voiceGate(0);
        filterGate(0);
    });

    ribbon2.addEventListener("mousedown", function(event) {
        swarmTone(event);

        ribbon2.addEventListener("mousemove", swarmTone);
    });

    ribbon2.addEventListener("mouseup",function(event) {
        ribbon2.removeEventListener("mousemove", swarmTone);
    });

    ribbon2.addEventListener("mouseleave",function(event) {
        ribbon2.removeEventListener("mousemove", swarmTone);
    });

    ribbon2.addEventListener("touchstart", function(event) {
        swarmTone(event);
        ribbon2.addEventListener("touchmove", swarmTone);
    });

    ribbon2.addEventListener("touchend",function(event) {
        ribbon2.removeEventListener("touchmove", swarmTone);
    });
}();