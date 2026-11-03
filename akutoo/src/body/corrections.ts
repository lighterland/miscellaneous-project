export const bodyRatioKeys=['shoulderToHip','torsoToLeg','armToHeight','headToHeight','shoulderWidthCm'] as const;
export type BodyCorrections=Partial<Record<typeof bodyRatioKeys[number],number>>;
export function parseBodyCorrections(values:Partial<Record<typeof bodyRatioKeys[number],string>>):BodyCorrections {
    const result:BodyCorrections={};
    for(const key of bodyRatioKeys){const text=values[key]?.trim()??'';if(!text)continue;const value=Number(text);if(!Number.isFinite(value)||value<=0)throw new Error('Invalid body correction');result[key]=value;}
    return result;
}
