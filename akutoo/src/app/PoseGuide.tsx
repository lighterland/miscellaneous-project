import type {AnalysisResult} from '../analysis/protocol';
import type {Shot} from '../session/shotlist';
import {s} from '../i18n/strings.en';

export function PoseGuide({shot,pose,mirror}:{shot:Shot;pose:AnalysisResult['pose'];mirror:boolean}) {
  // A camera-facing schematic; mirror it with the selfie preview, never its labels.
  const yaw=shot.yaw*Math.PI/180, pitch=shot.pitch*Math.PI/180;
  const nose=-Math.sin(yaw)*24, lift=Math.sin(pitch)*18;
  const width=24-Math.abs(Math.sin(yaw))*7;
  return <div className="pose-guide">
    <svg viewBox="0 0 100 108" role="img" aria-label={s.poseTargetName(shot.yaw,shot.pitch)}>
      <g transform={mirror?'translate(100 0) scale(-1 1)':undefined} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 103 Q18 82 37 82 L39 73 M84 103 Q82 82 63 82 L61 73"/>
        <ellipse cx="50" cy="45" rx={width} ry="33"/>
        <path d={`M${50+nose*.35} ${37+lift} l${nose*.65} 13 l-7 3`}/>
        <path d={`M${50+nose*.5-9} ${64+lift*.5} q7 3 14 0`}/>
        <circle cx={50+nose*.4-10} cy={35+lift} r="1.7" fill="currentColor"/>
        <circle cx={50+nose*.4+10} cy={35+lift} r="1.7" fill="currentColor" opacity={Math.abs(shot.yaw)>60?0:1}/>
        {shot.yaw!==0&&<path d={nose>0?'M68 9 H90 l-6 -5 M90 9 l-6 5':'M32 9 H10 l6 -5 M10 9 l6 5'} stroke="#ff7a2f"/>}
        {shot.pitch!==0&&<path d={shot.pitch<0?'M90 63 V28 l-5 6 M90 28 l5 6':'M90 28 V63 l-5 -6 M90 63 l5 -6'} stroke="#ff7a2f"/>}
      </g>
    </svg>
    <div><strong>{s.poseTarget}</strong><p>{s.shotInstruction(shot)}</p><small>{mirror?s.poseMirror:s.poseCameraView}</small><small>{pose?s.poseLive(pose.yaw,pose.pitch):s.poseWaiting}</small></div>
  </div>;
}
