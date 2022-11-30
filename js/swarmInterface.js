"use strict";

const knobUtils = {
	getAngle: element => {
		const st = window.getComputedStyle(element);		

		const tr = st.getPropertyValue("-webkit-transform") ||
        st.getPropertyValue("-moz-transform") ||
        st.getPropertyValue("transform");

		if (!tr || tr === 'none') {
      return 0;
    }

		const values = tr.split('(')[1].split(')')[0].split(',');
		const a = values[0];
		const b = values[1];
		const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
		return angle;
	},

	setKnobTimings:  time => {
		const knobs = document.querySelectorAll('.knob > .body');

		[].forEach.call(knobs, each => {
			each.style.transitionDuration="." + time + "s";
		});
	},

	turnKnob: (knob, callback) => {
		let prevPosition,
		currPosition = knobUtils.getAngle(knob);

		if (callback) {
      callback(currPosition);
    }

		const knobInit = event =>  {
			event.preventDefault();
			let turnStart;

			prevPosition = knobUtils.getAngle(knob);
			
			if (event.touches) {
        turnStart = event.changedTouches[0].clientY;
      } else {
        turnStart = event.clientY;
      }

			const knobTurn = event => {
				event.preventDefault();
				if (event.touches) {
          currPosition = prevPosition - event.changedTouches[0].clientY + turnStart;
        } else {
          currPosition = prevPosition - event.clientY + turnStart;
        }

				if (currPosition > - 151 && currPosition < 151)	{
					knob.style.webkitTransform = 'rotate(' + currPosition + 'deg)'; 
          knob.style.mozTransform = 'rotate(' + currPosition + 'deg)';
          knob.style.transform = 'rotate(' + currPosition + 'deg)';
					callback(currPosition); 
				}
			}

			document.addEventListener('mousemove', knobTurn);
			document.addEventListener('touchmove', knobTurn);

			document.addEventListener("mouseup", () => {
				document.removeEventListener("mousemove", knobTurn);
			});	

			document.addEventListener("touchend", () => {
				document.removeEventListener("touchmove", knobTurn);
			});					
		}

		knob.addEventListener("mousedown", knobInit);
		knob.addEventListener("touchstart", knobInit);
		return currPosition;
	},

	setKnob: (knob, turnValue, callback) => {
		knob.style.webkitTransform = 'rotate(' + turnValue + 'deg)'; 
    knob.style.mozTransform = 'rotate(' + turnValue + 'deg)';
    knob.style.transform = 'rotate(' + turnValue + 'deg)';
		callback(turnValue);
		return turnValue;
	},

	//linear scaling of knob position in degrees, 0 being straight up; 'amp' represents amplitude
	linScale: (knobPosition, amp) => {
		return amp * (knobPosition + 150)  / 300;
	},

	//exponential scaling. curve shape represents 'severity' of curve
	expScale: (knobPosition, amp, curveShape) => {
		return amp * (Math.exp(curveShape * (knobPosition + 150) / 300) - 1) / (Math.exp(curveShape) - 1);
	}
};

const switches = () => {
	const pSwitch = document.getElementById("powerSwitch"),
	vSwitch = document.getElementsByClassName("pushswitch");
	let powerOn;

	const powerSwitch = () => { 
		powerOn = true;

		const flipSwitch = function(event) {
			event.preventDefault();
			self = this;
			self.classList.toggle('on');

			if (self.classList.contains("on")) { 
				powerOn = true;
				[].forEach.call(vSwitch, (each, idx) => {
					if ((each).classList.contains('pushed')) {
						each.classList.add('on');
						swarmSynth.voices[idx].voiceOn();
					}
				});
			}
			else { 
				powerOn = false;
				[].forEach.call(vSwitch, (each, idx) => {
					each.classList.remove('on');
					swarmSynth.voices[idx].voiceOff();
				});

				swarmSynth.resetEnvelopes();
			}
		}

		pSwitch.addEventListener("click", flipSwitch);
		pSwitch.addEventListener('touchstart', flipSwitch);
	};

  powerSwitch();

	//toggle individual voices on or off
	const voices = () => {	
		const pushSwitch = function(event) {
			event.preventDefault();
			if (powerOn) {
        this.classList.toggle("on");
      }
			this.classList.toggle("pushed");
			
			if (this.classList.contains("on")) {
        swarmSynth.voices[this.idx].voiceOn();
      } else {
        swarmSynth.voices[this.idx].voiceOff();
      }
		}

		for(let i = 0; i < vSwitch.length; i++){
			vSwitch[i].idx = i;
			vSwitch[i].addEventListener("click", pushSwitch);
			vSwitch[i].addEventListener("touchstart", pushSwitch);
		};
	};
  voices();
};

switches();

const envController = function() {
	const env = swarmSynth.envSettings;

	const scaleEnvTime = knobPosition => {
		const scaledEnv = knobUtils.expScale(knobPosition, 3, 3);
		return scaledEnv;				
	}

	const scaleEnvLevel = knobPosition => {
		const scaledEnv = knobUtils.expScale(knobPosition, 3, 4);
		return scaledEnv;				
	}

	const settings = {
		setAttack: knobPosition => {
			env.attackTime = scaleEnvTime(knobPosition)
		},
		setDecay: knobPosition => {
			env.decayTime = scaleEnvTime(knobPosition);
		},
		setSustain: knobPosition => {
			env.sustainLevel = scaleEnvLevel(knobPosition);
		},
		setRelease: knobPosition => {
			env.releaseTime=scaleEnvTime(knobPosition);
		}
	}
	return settings;
}();

const setVolume = knobPosition => {
	const scaledVolume = knobUtils.expScale(knobPosition, 1, 6);
	swarmSynth.setVolume(scaledVolume);
}

const setDrive = knobPosition => {
	const scaledDrive = (knobPosition + 150);
	swarmSynth.setDrive(scaledDrive);
}

const filterController = function() {
	let knobCut = 0, 
	ribbonCut = 0,
	ribbonTrack;

	//combining cutoff set by knob and the cutoff value from ribbon tracking
	const setCutoff = () => {
		const controlVal = knobCut + ribbonCut;
		const cutoff = 156 * Math.pow(2, controlVal);
		swarmSynth.setCutoff(cutoff);
	}

	const settings = {
		setTrack: knobPosition => {
			ribbonTrack=knobUtils.linScale(knobPosition, 1);
		},

		cutoffKnob: knobPosition => {
			knobCut= knobUtils.linScale(knobPosition, 6);
			setCutoff();
		},

		ribbonTrack: ribPos => {
			ribbonCut = ribbonTrack * ribPos / 166.7;
			setCutoff();
		},

		setResonance: knobPosition => {
			const scaledResonance = knobUtils.linScale(knobPosition, 60)
			swarmSynth.setRes(scaledResonance);
		},

		setEnv: knobPosition => {
			var scaledFilterEnv = knobUtils.linScale(knobPosition, 1);
			swarmSynth.envSettings.filterEnv = scaledFilterEnv;
		}
	}
	return settings;
}();

const setPanelKnobs = function(knobs) {
	let knob, init;

	const panelKnobs = [{
			id:'vol',
			turnValue: 90,
			callback:setVolume
		},
		{
			id:'cutoff',
			turnValue: 45,
			callback:filterController.cutoffKnob
		},
		{
			id:'track',
			turnValue: -20,
			callback:filterController.setTrack
		},
		{
			id:'env',
			turnValue: -50,
			callback:filterController.setEnv
		},
		{
			id:'res',
			turnValue: -120,
			callback:filterController.setResonance
		},
		{
			id:'attack',
			turnValue: -140,
			callback:envController.setAttack
		},
		{
			id:'decay',
			turnValue: -90,
			callback:envController.setDecay
		},
		{
			id:'sustain',
			turnValue: 10,
			callback:envController.setSustain
		},
		{
			id:'release',
			turnValue: 50,
			callback:envController.setRelease
		},
		{
			id:'drive',
			turnValue: -150,
			callback: setDrive
		}
	];

	if (!knobs) {
		knobs = panelKnobs;
		init = true;				
	} else  {
    knobUtils.setKnobTimings(0.5);
  }
	
	for(let i = 0; i < knobs.length; i++) {
		knob = document.querySelector('#' + panelKnobs[i].id  + ' > .body');
		if (init) {
      knobUtils.turnKnob(knob, panelKnobs[i].callback);
    }		
		knobUtils.setKnob(knob, panelKnobs[i].turnValue, panelKnobs[i].callback);
	}
	knobUtils.setKnobTimings(0);
}();

const ribbonController = function() {
	let startup;
	const ribbon1 = document.getElementById("ribbon1");
	const ribbon1Offset = parseInt(ribbon1.getBoundingClientRect().left);

	const ribbon2 = document.getElementById("ribbon2");
	const ribbon2Offset = parseInt(ribbon2.getBoundingClientRect().left);

	const swarmRibMargin = 10;
  let cluster = [];
  let centerNote;
  let swarmInterval = 0.1;

  const pitchRibbonScale = 1000 / ribbon1.getBoundingClientRect().width;
  const swarmRibbonScale = 125 / ribbon2.getBoundingClientRect().width;

  const voiceGate = swarmSynth.volEnvelope;
	const filterGate = swarmSynth.filterEnvelope;
    
  const noteToTone = note => {
    return 16.35 * Math.pow(2, (note/125));
  } 
    
  //this array is a cluster of 8 voice frequencies
  const makeCluster = note => {
    let tone;
    const toneCeiling = 1150;
    cluster=[];
    for(let i = 0; i < 8; i++){
      tone = note + (i - 3.5) * swarmInterval;
      if (tone >= toneCeiling) {
        tone = toneCeiling;
      }
      cluster.push(noteToTone(tone));	
    }
    return(cluster);
  }

  const sendTone = event => {
    event.preventDefault();
    if (event.touches) {
      if (checkRibbonBoundaries(event.changedTouches[0])) {
        ribbon1.removeEventListener("touchmove", sendTone);
        voiceGate(0);
        filterGate(0);
        return;
      }
      centerNote = (event.changedTouches[0].clientX - ribbon1Offset) * pitchRibbonScale;
    } else {
      centerNote=(event.clientX - ribbon1Offset)*pitchRibbonScale;
    }
    
    if (!startup) {
      startup = swarmSynth.startVoices();
    }

    swarmSynth.setPitches(makeCluster(centerNote));
    filterController.ribbonTrack(centerNote);
  }

  const swarmTone = event => {
    event.preventDefault();
    if (event.touches) {
      if (checkRibbonBoundaries(event.changedTouches[0])) {
        ribbon2.removeEventListener("touchmove", swarmTone);
        return;
      }
      swarmInterval = (event.changedTouches[0].clientX - ribbon2Offset - swarmRibMargin) * swarmRibbonScale;
    }	
    else {
      swarmInterval=(event.clientX - ribbon2Offset - swarmRibMargin) * swarmRibbonScale;
    }
    
    swarmSynth.setPitches(makeCluster(centerNote));
  }

  const checkRibbonBoundaries = evt => {
		const xpos = evt.clientX
		const ypos = evt.clientY
		const bound = evt.target.getBoundingClientRect();

		if (xpos < bound.left || 
			xpos > bound.right||
			ypos < bound.top ||
			ypos > bound.bottom) {

			return true;
		}
		else return false;
	}
    
  const ribbon1Down = event => {
    sendTone(event);	            
    voiceGate(1);
    filterGate(1);
  }

  ribbon1.addEventListener("mousedown", event => {
      ribbon1Down(event);
      ribbon1.addEventListener("mousemove", sendTone);
  });

  ribbon1.addEventListener("mouseup", event => {
      ribbon1.removeEventListener("mousemove", sendTone);
      voiceGate(0);
      filterGate(0);
  });

  ribbon1.addEventListener("mouseleave", event => {
      ribbon1.removeEventListener("mousemove", sendTone);
      voiceGate(0);
      filterGate(0);
  });

  ribbon1.addEventListener("touchstart",  event => {
      ribbon1Down(event);
      ribbon1.addEventListener("touchmove", sendTone);
  });

  ribbon1.addEventListener("touchend", event => {
      ribbon1.removeEventListener("touchmove", sendTone);
      voiceGate(0);
      filterGate(0);
  });

  ribbon2.addEventListener("mousedown",  event => {
      swarmTone(event);

      ribbon2.addEventListener("mousemove", swarmTone);
  });

  ribbon2.addEventListener("mouseup", event => {
      ribbon2.removeEventListener("mousemove", swarmTone);
  });

  ribbon2.addEventListener("mouseleave", event => {
      ribbon2.removeEventListener("mousemove", swarmTone);
  });

  ribbon2.addEventListener("touchstart",  event => {
      swarmTone(event);
      ribbon2.addEventListener("touchmove", swarmTone);
  });

  ribbon2.addEventListener("touchend", () => {
      ribbon2.removeEventListener("touchmove", swarmTone);
  });
}();