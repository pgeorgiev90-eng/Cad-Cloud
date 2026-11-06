const clean = value => typeof value === 'string' ? value.trim().slice(0,120) : '';
const normal = value => clean(value).toUpperCase().replace(/[^A-Z0-9]/g,'');
const codeKeys = ['SKU','ARTICLE','ARTICLENO','ARTIKELNUMMER','PARTNO','PARTNUMBER','CATALOGNO','CATALOGNUMBER','EAN','MODEL'];
const infoKeys = ['NAME','DESCRIPTION','MANUFACTURER','RATING','CURRENT','POLES','WIDTH','HEIGHT','DEPTH','TAG'];
export function equipmentFromDwg(database) {
    const rows = new Map();
    let blocks = 0;
    for (const entity of database.entities || []) {
        if (entity.type !== 'INSERT') continue;
        blocks++;
        const block = clean(entity.name);
        const attributes = new Map();
        for (const attr of entity.attribs || []) {
            const key = normal(attr.tag || attr.attrTag);
            const value = clean(attr.text?.text);
            if (key && value) attributes.set(key,value);
        }
        const codes = [...new Set(codeKeys.map(key=>attributes.get(key)).filter(Boolean))];
        // Many manufacturer blocks use their SKU as the block name.
        const blockTokens = block.split(/[^a-z0-9-]+/i).filter(token=>/[a-z]/i.test(token)&&/\d/.test(token)&&token.length>=5);
        const candidates = [...new Set([...codes,block,...blockTokens])].filter(Boolean);
        const details = Object.fromEntries(infoKeys.filter(key=>attributes.has(key)).map(key=>[key,attributes.get(key)]));
        const key = JSON.stringify([block,codes,details]);
        if (rows.has(key)) rows.get(key).count++;
        else if (rows.size<250) rows.set(key,{block,codes,candidates,details,count:1});
    }
    return {blocks, rows:[...rows.values()], shown:[...rows.values()].reduce((sum,row)=>sum+row.count,0)};
}
