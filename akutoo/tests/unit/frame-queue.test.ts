import {expect,it} from 'vitest';
import {FrameQueue} from '../../src/capture/frame-queue';
it('bounds waiting frames, rejects duplicate work and releases every discarded frame',()=>{
 const discarded:number[]=[];const queue=new FrameQueue<{index:number}>(2,frame=>discarded.push(frame.index));
 queue.offer({index:1});queue.offer({index:1});queue.offer({index:2});queue.offer({index:3});
 expect(discarded).toEqual([1,3]);expect(queue.indices()).toEqual([1,2]);
 expect(queue.take()).toEqual({index:1});queue.clear();expect(discarded).toEqual([1,3,2]);expect(queue.take()).toBeUndefined();
});
