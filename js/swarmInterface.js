"use strict";

var knobUtils = function(){
	function getAngle(element){
		var tr=element.css('transform');
		if(tr=="none") return 0;
		var values = tr.split('(')[1].split(')')[0].split(',');
		var a = values[0];
		var b = values[1];

		var scale = Math.sqrt(a*a + b*b);
		var sin = b/scale;
		var angle = Math.round(Math.atan2(b, a) * (180/Math.PI));
		return angle;
	}

	function turnKnob(knob, callback){
		var doc=$(document),
		prevPosition,
		currPosition=getAngle(knob);
		if(callback) callback(currPosition);
		
		knob.on("mousedown", function(event) {
			prevPosition=getAngle(knob);
			var mouseStart=event.clientY;
			doc.on('mousemove', function(event){
				currPosition=prevPosition - event.clientY + mouseStart;
				if(currPosition>-151&&currPosition<151)	{
					knob.css({'transform':'rotate(' + currPosition + 'deg)'});
					callback(currPosition);
				}
			});					
		});

		doc.on("mouseup", function(event){
			doc.off("mousemove");
		})
		return currPosition;
	}

	function setKnob(knob, turnValue, callback){
		knob.css({'transform':'rotate(' + turnValue + 'deg)'});
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
		linScale:linScale,
		expScale:expScale
	}
}();

var switches = function(){
	var pSwitch=$("#powerSwitch"),
	vSwitch=$(".pushswitch");

	var powerSwitch = function() { 
		var powerOn=true;
		pSwitch.click(function() {
			self=$(this);
			self.toggleClass('on');

			if(self.hasClass("on")){ 
				powerOn=true;
				vSwitch.each(function(){
					self=$(this);
					if(self.hasClass("pushed")) self.addClass("on");
				});
			}
			else { 
				powerOn=false;
				vSwitch.removeClass("on");
				swarmSynth.resetEnvelopes();
			}

			for(var i=0; i<swarmSynth.voices.length; i++){
				powerOn ? swarmSynth.voices[i].voiceOn():swarmSynth.voices[i].voiceOff();
			}
		});
	}();

	//toggle individual voices on or off
	var voices=function(){
		vSwitch.click(function(){
			self=$(this);
			self.toggleClass("on");
			self.toggleClass("pushed");
			if(self.hasClass("on")) swarmSynth.voices[vSwitch.index(this)].voiceOn();
			else swarmSynth.voices[vSwitch.index(this)].voiceOff();
		});
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
	} else $(".knob .body").css("transition-duration", "0.5s")
	

	for(var i=0; i<knobs.length;i++){
		knob=$("#" + panelKnobs[i].id + " .body");
		if(init) knobUtils.turnKnob(knob, panelKnobs[i].callback);
		knobUtils.setKnob(knob, panelKnobs[i].turnValue, panelKnobs[i].callback);
	}
	$(".knob .body").css("transition-duration", "0s");
}();

var ribbonController = function(){
	var ribbon1=$("#ribbon1");
	var ribbon1Offset=parseInt(ribbon1.offset().left);

	var ribbon2=$("#ribbon2");
	var ribbon2Offset=parseInt(ribbon2.offset().left);
	var swarmRibMargin=10;
    var cluster = [];
    var centerTone;
    var centerNote;
    var swarmInterval=.1;

    var pitchRibbonScale=1000/ribbon1.width();
    var swarmRibbonScale=125/ribbon2.width();

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
    	centerNote=(event.clientX - ribbon1Offset)*pitchRibbonScale;
        swarmSynth.setPitches(makeCluster(centerNote));
        filterController.ribbonTrack(centerNote);
    }

    function swarmTone(event){	        	
    	swarmInterval=(event.clientX-ribbon2Offset-swarmRibMargin)*swarmRibbonScale;
    	swarmSynth.setPitches(makeCluster(centerNote));
    }

    ribbon1.on("mousedown", function(event) {
        sendTone(event);	            
        voiceGate(1);
        filterGate(1);

        ribbon1.on("mousemove", function(event){
            sendTone(event);
        });
    });

    ribbon1.on("mouseup mouseleave",function(event) {
        ribbon1.off("mousemove");
        voiceGate(0);
        filterGate(0);
    });


    ribbon2.on("mousedown", function(event) {
        swarmTone(event);

        ribbon2.on("mousemove", function(event){
            swarmTone(event);
        });
    });

    ribbon2.on("mouseup mouseleave",function(event) {
        ribbon2.off("mousemove");
    });
}();