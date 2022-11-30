"use strict";

const swarmSynth = (() => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContext();
  const swOverdrive = context.createWaveShaper();

  // distortion algorithm
  const makeDistortionCurve = amount => {
    const k = amount,
      n_samples = 44100,
      curve = new Float32Array(n_samples)
      let x;
      for (let i = 0; i < n_samples; i++) {
        x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x / (3 * (3 + k * Math.abs(x)));
      }
    return curve;
  };

  swOverdrive.curve = makeDistortionCurve(0);
  swOverdrive.oversample = '4x';

  const setDrive = a => {        
    swOverdrive.curve = makeDistortionCurve(a);
  }

  const swarmFilter = context.createBiquadFilter();
  
  swarmFilter.type = "lowpass";
  swarmFilter.frequency.value = 100;
  swarmFilter.Q.value = 10;
  swarmFilter.detune.value = 0;
  
  const swarmFilterDetune=swarmFilter.detune;

  const setCutoff = cutoff => {
    swarmFilter.frequency.value=cutoff;
  }

  const setRes = res => {        
    swarmFilter.Q.value=res;
  }
  
  const voiceMerger = context.createChannelMerger(8);
  const envNode=context.createGain();
  envNode.gain.value = 0;
  
  //using two gain nodes, one for overall volume, one for volume envelope
  const swarmVol = context.createGain();
  swarmVol.gain.value = 0;

  const setVolume = v => {
    swarmVol.gain.value = v;
  }

  const envNodeGain=envNode.gain;
  
  const Createvoice = () => {
    const vco = context.createOscillator();
    vco.type = "sawtooth";
    vco.frequency.value = 100;

    const vca = context.createGain();
    vca.gain.value = 0.125;
    vco.connect(vca);
    vca.connect(envNode);

    const setFrequency = freq => {
        vco.frequency.value=freq;
    }

    const voiceOn = () => {
        vca.gain.value=0.125;
    }

    const voiceOff = () => {
        vca.gain.value=0;
    }

    const voiceVol = v => {
        vca.gain.value=v;
    }

    return { 
      setFrequency:setFrequency,
      voiceOn:voiceOn,
      voiceOff:voiceOff,
      voiceVol:voiceVol,
      vca:vca,
      vco:vco
    }
  }
  
  const voices = [];

  //create the 8 oscillators with individual gain nodes and connect all outputs to one channel of voice merger    
  for(let i = 0; i < 8; i++){
    const voice =  Createvoice();
    voice.vca.connect(voiceMerger, 0, 0);
    voices.push(voice);
  }
  
  //set voice frequencies
  const setPitches = freqArray => {
    for(let i = 0; i < freqArray.length; i++){
      voices[i].setFrequency(freqArray[i]);
    }
  }

  const envSettings={
    attackTime:1,
    peakLevel:1,        
    decayTime:1,            
    sustainLevel:1,
    releaseTime:1,
    filterEnv:0 // this value applies only to the filter envelope
  }

  const volEnvelope = n => {
    const param=envNodeGain;
    const now=context.currentTime;
    let lastValue;
      
    if (n) {
      lastValue=param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(lastValue, now);
      param.linearRampToValueAtTime(envSettings.peakLevel, now + envSettings.attackTime);
      param.setTargetAtTime(envSettings.sustainLevel, now + envSettings.attackTime, envSettings.decayTime);
    } else {
      lastValue = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(lastValue||envSettings.sustainLevel, now);
      param.setTargetAtTime(0, now, envSettings.releaseTime);
    }      
  };

  const filterEnvelope = gate => {
    const param = swarmFilterDetune;               
    const now = context.currentTime;
    
    const envScale = 4000; //scale the 0 ->1 of vol envelope to detune in cents value

    const filterPeak = envSettings.peakLevel * envScale * envSettings.filterEnv;
    const floor= -(filterPeak); //we are making the detune symmetrical around 0
    
    if (gate) {
        param.cancelScheduledValues(now);
        param.setValueAtTime(0, now);
        param.linearRampToValueAtTime(filterPeak, now + envSettings.attackTime);
        param.setTargetAtTime(0, now + envSettings.attackTime, envSettings.decayTime);
    } else { 
        param.setTargetAtTime(floor, now, envSettings.releaseTime);
    }
  }
  
  const resetEnvelopes = () => {
    const now = context.currentTime;
    envNodeGain.cancelScheduledValues(now);
    envNodeGain.value = 0;
    swarmFilterDetune.cancelScheduledValues(now);
    swarmFilterDetune.value=0;
  }
  
  const startVoices = () => {
    for (let voice of voices) {
      voice.vco.start(0)
    }
    return voices[0].vco;
  }

  voiceMerger.connect(envNode);
  envNode.connect(swarmFilter);
  swarmFilter.connect(swOverdrive);
  swOverdrive.connect(swarmVol);
  swarmVol.connect(context.destination);

  return {
    context,
    voices,
    setPitches,
    setDrive,
    setCutoff,
    setRes,
    setVolume,
    envSettings,
    volEnvelope,
    filterEnvelope,
    resetEnvelopes,
    startVoices
  }
})();