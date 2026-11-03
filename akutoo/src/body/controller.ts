import {BodyClient} from './client';
import {freshBody,type BodySession} from './state';
import {bodyShots,type BodyShot} from './plan';
import {bodyRatios} from './metrics';
import {gradeBody} from './quality';
import type {BodyAnalysis} from './protocol';
import {BrowserCamera,jpeg,thumbnail,type CameraSource} from '../capture/camera';
import {hairBaseline} from '../hair/quality';
import {beginRound,advanceRound,finishAngle,stopRound,redoRound,rotation,type Round} from '../solo/round';
import {SoloEffects} from '../solo/effects';
import {putSession} from '../storage/sessions';
import {saveBodyPhoto} from '../storage/body';
import type {Session,Photo} from '../storage/db';
import type {QualityResult} from '../gates/quality';
import {elapsedAttempts,nextSlot,recordFailure,resetCause} from '../session/attempts';
import {targetAttemptState,revisitTarget} from '../session/target-attempts';
import {s} from '../i18n/strings.en';
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export interface BodyState {
    session:Session;stage:'choice'|'mount'|'scan'|'summary';running:boolean;loading:boolean;busy:boolean;modelFailed:boolean;
    round:Round|null;observation:BodyAnalysis|null;message:string;seconds:number;selected:string;
    pending:{photo:Photo;full:Blob;thumb:Blob;url:string}|null;capturing:boolean;countdown:boolean;
}
export class BodyController {
    state:BodyState;effects=new SoloEffects();
    private camera:CameraSource;private client?:BodyClient;private timer?:ReturnType<typeof setTimeout>;
    private disposed=false;private generation=0;private writes=Promise.resolve();
    private reference:{began:number;values:{sharpness:number;exposure:number}[]}|null=null;private lastSecond:number|null=null;
    constructor(private video:HTMLVideoElement,session:Session,private changed:(state:BodyState)=>void,camera?:CameraSource){
        this.camera=camera??new BrowserCamera(video);
        this.state={session:{...session,body:session.body??freshBody()},stage:session.retakePhotoId?'mount':'choice',running:false,loading:false,busy:false,modelFailed:false,round:null,observation:null,message:'',seconds:5,selected:session.retakeShotId??'angle-front',pending:null,capturing:false,countdown:false};this.schedule();
    }
    get set(){const body=this.state.session.body!;return body.sets[body.mode]??={results:{}};}
    private emit(){if(!this.disposed)this.changed({...this.state});}
    private persist(){this.state.session.updatedAt=Date.now();const snapshot=structuredClone(this.state.session);this.writes=this.writes.then(async()=>{snapshot.revision=this.state.session.revision;await putSession(snapshot);this.state.session.revision=snapshot.revision;});return this.writes;}
    async configure(patch:Partial<BodySession>){if(this.state.busy||this.state.loading||this.activeRound())return;if(patch.heightCm!==undefined&&patch.heightCm!==null&&(!Number.isFinite(patch.heightCm)||patch.heightCm<=0))throw new Error('Invalid height');const b=this.state.session.body!;if(patch.mode!==undefined&&patch.mode!==b.mode||patch.assistance!==undefined&&patch.assistance!==b.assistance){this.stopCamera();this.state.round=null;this.state.stage='mount';}Object.assign(b,patch);if(!b.details&&this.state.selected.startsWith('detail-'))this.state.selected='angle-front';this.emit();await this.persist();}
    mount(){this.state.stage='mount';this.emit();}
    select(id:string){if(this.state.busy||this.activeRound())return;this.state.selected=id;this.emit();}
    private activeRound(){return !!this.state.round&&!['done','stopped'].includes(this.state.round.phase);}
    async start(facing:'user'|'environment'){
        if(this.state.busy||this.state.loading||this.state.session.body!.assistance==='handheld')return;
        this.stopCamera();const generation=this.generation;this.state.loading=true;this.state.message=s.bodyLoading;this.emit();
        try{
            const track=await this.camera.open(facing);if(generation!==this.generation)return;
            const settings=track.getSettings();this.state.session.camera=settings.facingMode==='environment'?'environment':settings.facingMode==='user'?'user':facing;
            this.state.session.stream=settings.width&&settings.height?{width:settings.width,height:settings.height}:undefined;
            track.onended=()=>this.interrupt();this.state.running=true;this.state.stage='mount';this.state.modelFailed=false;this.set.baseline=undefined;this.reference=null;this.state.observation=null;this.state.seconds=5;
            this.client=new BodyClient();try{await this.client.load();}catch{this.client.close();this.client=undefined;this.state.modelFailed=true;}
            if(generation!==this.generation)return;this.state.message=this.client?s.bodyCalibrating:s.bodyManualOnly;await this.persist();
        }catch{this.stopCamera();this.state.message=s.cameraError;}finally{this.state.loading=false;this.emit();}
    }
    private schedule(){if(!this.disposed)this.timer=setTimeout(()=>void this.tick(),100);}
    private async tick(){
        try{
            const p=this.state.session.progress!;const elapsed=elapsedAttempts(p.attempts,Date.now());if(elapsed!==p.attempts){p.attempts=elapsed;await this.persist();this.emit();}
            const round=this.state.round;
            if(round&&!['done','stopped'].includes(round.phase)){
                const second=Number.isFinite(round.deadline)?Math.ceil((round.deadline-performance.now())/1000):0;
                if(second!==this.lastSecond){this.lastSecond=second;this.emit();}
                const next=advanceRound(round,performance.now());if(next!==round){this.state.round=next;this.cue(next);this.emit();}
                if(this.state.round?.phase==='capture'&&!this.state.round.rehearsal&&!this.state.busy){const shot=bodyShots(this.state.session.body!.mode).find(item=>item.id===`angle-${this.state.round!.angle}`)!;await this.capture(shot,false);}
                if(this.state.round?.phase==='done'){this.state.stage='summary';this.state.message=this.state.round.rehearsal?s.practiceDone:s.roundDone;this.effects.stop();this.emit();}
            }else if(this.state.running&&this.client&&!this.state.busy&&!this.state.loading&&!this.state.pending&&this.state.stage==='mount'){
                const generation=this.generation,frame=this.camera.frame();
                try{
                    const result=await this.client.measure(frame);if(generation!==this.generation)return;this.state.observation=result;
                    const metrics=result.metrics;
                    if(!this.set.baseline&&metrics&&(metrics.sharpness??0)>0&&(metrics.exposure??0)>0&&!gradeBody(result,{sharpness:metrics.sharpness!,exposure:metrics.exposure!},this.state.session.body!.mode).hardFailure){
                        const now=performance.now();this.reference??={began:now,values:[]};this.reference.values.push({sharpness:metrics.sharpness!,exposure:metrics.exposure!});this.state.seconds=Math.max(0,Math.ceil((5000-(now-this.reference.began))/1000));
                        if(this.state.seconds===0){this.set.baseline=hairBaseline(this.reference.values)??undefined;await this.persist();this.state.message=s.bodyReferenceReady;}
                    }else if(!this.set.baseline){this.reference=null;this.state.seconds=5;}
                    this.emit();
                }catch{this.client?.close();this.client=undefined;this.state.modelFailed=true;this.state.observation=null;this.state.message=s.bodyManualOnly;this.emit();}finally{frame.width=0;}
            }
        }catch{this.interrupt();this.state.message=s.saveError;this.emit();}finally{this.schedule();}
    }
    private cue(round:Round){if(round.phase==='turn'){this.effects.tone('turn');const move=rotation(round.cursor?round.queue[round.cursor-1]:null,round.angle!);this.effects.speak(move.degrees?s.soloRotate(move.degrees,move.direction):s.hairAngles.front);}if(round.phase==='hold'){this.effects.tone('hold');this.effects.speak(s.soloHold);}if(round.phase==='capture')this.effects.tone('capture');}
    async begin(rehearsal:boolean,redo=false){
        if(this.state.busy||this.state.loading||this.state.pending||this.state.session.body!.assistance==='handheld'||(!rehearsal&&(!this.state.running||!this.set.baseline)))return;
        if(!rehearsal&&(!this.state.observation||gradeBody(this.state.observation,this.set.baseline??null,this.state.session.body!.mode).hardFailure))return;
        const generation=this.generation;await this.effects.enable();await this.effects.keepAwake();if(this.disposed||generation!==this.generation){this.effects.stop();return;}const body=this.state.session.body!;
        let round=beginRound({assistance:body.assistance,pace:body.pace,rehearsal},performance.now());
        if(!rehearsal){this.state.session.progress!.attempts=resetCause(this.state.session.progress!.attempts);for(const [id,result]of Object.entries(this.set.results))if(id.startsWith('angle-'))round.results[id.slice(6) as NonNullable<Round['angle']>]=result;if(redo||Object.keys(round.results).length)round=redoRound(round,performance.now());round.queue=round.queue.filter(angle=>!targetAttemptState(this.set,`angle-${angle}`).exhausted);if(!round.queue.length){round.phase='done';round.angle=null;}else round.angle=round.queue[0];}
        this.state.round=round;this.state.stage=round.phase==='done'?'summary':'scan';this.state.message=round.phase==='done'?s.roundDone:'';this.effects.speak(s.soloPrepare);this.emit();
    }
    private missing(width:number,height:number):BodyAnalysis{return {detectedPoses:null,landmarks:[],bounds:null,targetArea:null,metrics:null,sourceDimensions:{width,height},durationMs:null,model:null};}
    private async measure(canvas:HTMLCanvasElement){try{if(this.client)return await this.client.measure(canvas);}catch{this.client?.close();this.client=undefined;this.state.modelFailed=true;}return this.missing(canvas.width,canvas.height);}
    async capture(shot:BodyShot,manual=true){
        if(!this.state.running||this.state.busy||this.state.loading||this.state.pending||targetAttemptState(this.set,shot.id).exhausted||this.state.session.progress!.attempts.sessionFix)return;
        const generation=this.generation,guard=()=>{if(generation!==this.generation)throw new DOMException('Interrupted','AbortError');};
        this.state.busy=true;this.state.capturing=true;this.emit();let best:{canvas:HTMLCanvasElement;analysis:BodyAnalysis;quality:QualityResult}|null=null;
        try{
            if(manual&&this.state.session.body!.assistance==='stand'){this.state.countdown=true;this.effects.speak(s.bodyTimer(this.state.session.body!.timer));for(let seconds=this.state.session.body!.timer;seconds>0;seconds--){this.state.seconds=seconds;this.state.message=s.bodyTimer(seconds);this.emit();await wait(1000);guard();}this.state.countdown=false;this.emit();}
            if(manual)this.effects.tone('capture');
            const began=performance.now();
            for(let i=0;i<5;i++){guard();const canvas=this.camera.frame(),analysis=await this.measure(canvas),quality=gradeBody(analysis,this.set.baseline??null,this.state.session.body!.mode,false,this.state.session.progress!.attempts.relaxed);
                if(!best||quality.score>best.quality.score||quality.score===best.quality.score&&(analysis.metrics?.sharpness??0)>(best.analysis.metrics?.sharpness??0)){if(best)best.canvas.width=0;best={canvas,analysis,quality};}else canvas.width=0;
                if(i<4)await wait(Math.max(0,began+(i+1)*125-performance.now()));}
            guard();if(!best)throw new Error('No frame');const full=await jpeg(best.canvas),decoded=await createImageBitmap(full);try{best.canvas.getContext('2d')!.drawImage(decoded,0,0);}finally{decoded.close();}
            best.analysis=await this.measure(best.canvas);best.quality=gradeBody(best.analysis,this.set.baseline??null,this.state.session.body!.mode,false,this.state.session.progress!.attempts.relaxed);const thumb=await jpeg(thumbnail(best.canvas));guard();
            const body=this.state.session.body!,id=crypto.randomUUID();
            const photo:Photo={id,sessionId:this.state.session.id,opfsPath:`sessions/${this.state.session.id}/${id}.jpg`,thumbPath:`thumbs/${id}.jpg`,width:best.canvas.width,height:best.canvas.height,createdAt:Date.now(),source:'captured',method:'canvas',camera:this.state.session.camera,streamDimensions:this.state.session.stream,shotId:`body-${body.mode}-${shot.id}`,quality:best.quality,override:false,relaxed:this.state.session.progress!.attempts.relaxed,bestAttempt:(this.set.attempts?.[shot.id]??0)>=2&&best.quality.tier==='C',body:{mode:body.mode,instruction:shot,labelSource:'instruction',analysis:best.analysis,baseline:this.set.baseline??null,heightCm:body.heightCm,estimatedRatios:shot.id==='neutral-front'?bodyRatios(best.analysis.landmarks,best.canvas.width,best.canvas.height,best.analysis.bounds,body.heightCm):null,reviewed:false}};
            if(best.quality.hardFailure||best.quality.tier==='D'){if(manual)this.state.pending={photo,full,thumb,url:URL.createObjectURL(full)};await this.failure(shot,best.quality.reason??'invalid');}else await this.commit(photo,full,thumb);
        }catch(error){if(!(error instanceof DOMException&&error.name==='AbortError')){this.interrupt();this.state.message=s.saveError;}}
        finally{if(best)best.canvas.width=0;this.state.busy=false;this.state.capturing=false;this.state.countdown=false;this.emit();}
    }
    private async failure(shot:BodyShot,reason:string){
        this.set.attempts??={};this.set.attempts[shot.id]=(this.set.attempts[shot.id]??0)+1;if(this.set.results[shot.id]?.status!=='saved')this.set.results[shot.id]={status:'failed',reason};
        const attempts=recordFailure(this.state.session.progress!.attempts,reason==='light'?'light':reason==='framing'?'distance':reason==='face'?'occlusion':'focus',Date.now());
        this.state.session.progress!.attempts=nextSlot(attempts);this.state.message=attempts.promptRetake===false?s.retryBudget:s.bodyFailure[reason as keyof typeof s.bodyFailure]??s.bodyFailure.invalid;
        if(this.state.round?.phase==='capture')this.state.round=finishAngle(this.state.round,{status:'failed',reason},performance.now());
        if(attempts.sessionFix){if(this.state.round)this.state.round=stopRound(this.state.round);this.state.stage='summary';this.effects.stop();this.state.message=s.sessionFixTitle+' '+this.state.message;}
        await this.persist();
    }
    private async commit(photo:Photo,full:Blob,thumb:Blob){
        await this.writes;const result=await saveBodyPhoto(this.state.session,photo,full,thumb);this.state.session=result.session;this.state.session.progress!.attempts=resetCause(this.state.session.progress!.attempts);
        const stored=this.set.results[photo.body!.instruction.id];if(this.state.round?.phase==='capture'&&stored?.status==='saved')this.state.round=finishAngle(this.state.round,{status:'saved',photoId:stored.photoId},performance.now());
        if(!this.activeRound())this.state.stage='summary';this.clearPending();this.state.message=result.saved?s.bodySaved:s.earlierKept;await this.persist();
    }
    async keep(){if(!this.state.pending||this.state.busy)return;this.state.busy=true;const p=this.state.pending;try{await this.commit({...p.photo,override:true},p.full,p.thumb);}catch{this.state.message=s.saveError;}finally{this.state.busy=false;this.emit();}}
    clearPending(){if(this.state.pending)URL.revokeObjectURL(this.state.pending.url);this.state.pending=null;this.emit();}
    async revisit(id:string){if(this.state.busy||this.state.loading||this.state.pending||this.activeRound())return;const body=this.state.session.body!;body.sets[body.mode]=revisitTarget(this.set,id);this.emit();await this.persist();}
    async recheck(){if(this.state.busy||this.state.pending)return;this.state.session.progress!.attempts=resetCause(this.state.session.progress!.attempts);this.set.baseline=undefined;this.reference=null;this.state.stage='mount';this.state.message=this.client?s.bodyCalibrating:s.bodyManualOnly;await this.persist();this.emit();}
    pause(){this.generation++;if(this.state.round)this.state.round=stopRound(this.state.round);this.state.stage='summary';this.effects.stop();this.emit();}
    private stopCamera(){this.generation++;this.camera.stop();this.client?.close();this.client=undefined;this.state.running=false;this.effects.stop();}
    interrupt(){this.stopCamera();if(this.state.round)this.state.round=stopRound(this.state.round);this.state.stage='mount';this.state.message=s.bodyInterrupted;this.emit();}
    async leave(){this.stopCamera();await this.writes;this.state.session.status='review';await this.persist();}
    dispose(){this.disposed=true;clearTimeout(this.timer);this.stopCamera();this.clearPending();this.effects.close();}
}
