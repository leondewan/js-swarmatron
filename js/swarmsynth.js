"use strict";

var swarmSynth=(function(){
    
    //This code is a bug fix for firefox v48 with respect to setTargetTime, an exponential Webaudio paramater decay.
    var linearEnv=false;
    var ua = navigator.userAgent.toLowerCase();
    if(ua.indexOf('firefox')!=-1){
        var startfox=ua.indexOf('firefox');
        var startver=startfox+8;
        var endver=startver+2; 
        var foxVersion=parseInt(ua.substring(startver, endver));
        linearEnv=true;
    }
    //end bug fix code


    var AudioContext = window.AudioContext || window.webkitAudioContext;
    var context = new AudioContext();

    var swOverdrive = context.createWaveShaper();

    //a basic distortion algorithm that everybody seems to use
    function makeDistortionCurve(amount) {
      var k = amount,
        n_samples = 44100,
        curve = new Float32Array(n_samples),
        x;

      for (var i=0; i<n_samples; i++) {
        x = i*2/n_samples-1;
        curve[i] = (3+k)*x/(3*(3+k*Math.abs(x)));
      }
      return curve;
    };

    swOverdrive.curve = makeDistortionCurve(0);
    swOverdrive.oversample = '4x';

    function setDrive(a){        
        swOverdrive.curve = makeDistortionCurve(a);
    }

    var swarmFilter=context.createBiquadFilter();
    
    swarmFilter.type = "lowpass";
    swarmFilter.frequency.value = 100;
    swarmFilter.Q.value = 10;
    swarmFilter.detune.value = 0;

    var swarmFilterCut=swarmFilter.frequency;
    var swarmFilterDetune=swarmFilter.detune;

    function setCutoff(cutoff){
        swarmFilter.frequency.value=cutoff;
    }

    function setRes(res){        
        swarmFilter.Q.value=res;
    }
    
    var voiceMerger=context.createChannelMerger(8);
    var envNode=context.createGain();
    envNode.gain.value=0;
    
    //using two gain nodes, one for overall volume, one for volume envelope
    var swarmVol=context.createGain();
    swarmVol.gain.value=0;

    function setVolume(v){
        swarmVol.gain.value=v;
    }

    var envNodeGain=envNode.gain;
    
    var Createvoice=function(){
        var vco = context.createOscillator();
        vco.type = "sawtooth";
        vco.frequency.value = 100;

        var vca = context.createGain();
        vca.gain.value = 0.125;
        vco.connect(vca);
        vca.connect(envNode);
        //vco.start(0);

        function setFrequency(freq){
            vco.frequency.value=freq;
        }

        function voiceOn(){
            vca.gain.value=0.125;
        }

        function voiceOff(){
            vca.gain.value=0;
        }

        function voiceVol(v){
            vca.gain.value=v;
        }

        return{ 
            setFrequency:setFrequency,
            voiceOn:voiceOn,
            voiceOff:voiceOff,
            voiceVol:voiceVol,
            vca:vca,
            vco:vco
        }
    }
    
    var voices=[];

    //create the 8 oscillators with individual gain nodes and connect all outputs to one channel of voice merger    
    for(var i=0;i<8;i++){
        var voice= new Createvoice;
        voice.vca.connect(voiceMerger, 0, 0);
        voices.push(voice);
    }
    
    //set voice frequencies
    function setPitches(freqArray){
        for(i=0;i<freqArray.length;i++){
            voices[i].setFrequency(freqArray[i]);
        }
    }

    var envSettings={
        attackTime:1,
        peakLevel:1,        
        decayTime:1,            
        sustainLevel:1,
        releaseTime:1,
        filterEnv:0 // this value applies only to the filter envelope
    }

    var volEnvelope = function (n){
        var param=envNodeGain;
        var now=context.currentTime;
        var lastValue;
        
        if(n){
            lastValue=param.value;
            param.cancelScheduledValues(now);
            param.setValueAtTime(lastValue, now);
            param.linearRampToValueAtTime(envSettings.peakLevel, now + envSettings.attackTime);
            
            //use linear envelope for firefox<=ver48
            if(linearEnv) param.linearRampToValueAtTime(envSettings.sustainLevel, now + envSettings.attackTime + envSettings.decayTime*2);            
            else param.setTargetAtTime(envSettings.sustainLevel, now + envSettings.attackTime, envSettings.decayTime);
        } else {
            
            lastValue=param.value;
            param.cancelScheduledValues(now);
            param.setValueAtTime(lastValue||envSettings.sustainLevel, now);
            
            //use linear envelope for firefox<=ver48
            if(linearEnv)param.linearRampToValueAtTime(0, now + envSettings.releaseTime*2);
            else param.setTargetAtTime(0, now, envSettings.releaseTime);  
        }      
    };

    function filterEnvelope(gate){
        var param=swarmFilterDetune;               
        var now=context.currentTime;
        
        var envScale=4000; //scale the 0 ->1 of vol envelope to detune in cents value

        var filterPeak=envSettings.peakLevel*envScale*envSettings.filterEnv;
        var floor= -(filterPeak);//we are making the detune symmetrical around 0
        
       if(gate){
            param.cancelScheduledValues(now);
            param.setValueAtTime(0, now);
            param.linearRampToValueAtTime(filterPeak, now + envSettings.attackTime);
            
            //use linear envelope for firefox<=ver48
            if(linearEnv) param.linearRampToValueAtTime(0, now + envSettings.attackTime + envSettings.decayTime);            
            else param.setTargetAtTime(0, now + envSettings.attackTime, envSettings.decayTime);
        } else { 
            
            //use linear envelope for firefox<=ver48
            if(linearEnv)param.linearRampToValueAtTime(floor, now + envSettings.releaseTime);
            else param.setTargetAtTime(floor, now, envSettings.releaseTime);
        }
    }

    
    //this is for when the unit is 'turned off' and 'back on again'
    function resetEnvelopes(){
        var now=context.currentTime;
        envNodeGain.cancelScheduledValues(now);
        envNodeGain.value=0;
        swarmFilterDetune.cancelScheduledValues(now);
        swarmFilterDetune.value=0;
    }

    //for IOS

    function startVoices(){
        for(var i=0;i<voices.length;i++){
            voices[i].vco.start(0);
        }
        return voices[0].vco;
    }

    voiceMerger.connect(envNode);
    envNode.connect(swarmFilter);
    swarmFilter.connect(swOverdrive);
    swOverdrive.connect(swarmVol);
    swarmVol.connect(context.destination);
    

    return {
        context:context,
        voices:voices,
        setPitches:setPitches,
        setDrive:setDrive,
        setCutoff:setCutoff,
        setRes:setRes,
        setVolume:setVolume,
        envSettings:envSettings,
        volEnvelope:volEnvelope,
        filterEnvelope:filterEnvelope,
        resetEnvelopes:resetEnvelopes,
        startVoices:startVoices
    }
})();