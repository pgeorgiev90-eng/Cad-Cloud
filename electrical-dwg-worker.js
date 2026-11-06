import { equipmentFromDwg } from './electrical-dwg-data.js';
const library = 'https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.8.4';

self.onmessage = async ({data}) => {
    try {
        const {LibreDwg,Dwg_File_Type}=await import(library+'/dist/libredwg-web.js');
        const decoder=await LibreDwg.create(library+'/wasm');
        const pointer=decoder.dwg_read_data(data,Dwg_File_Type.DWG);
        if (!pointer) throw Error('DWG could not be decoded');
        try {
            const database=decoder.convert(pointer);
            self.postMessage(equipmentFromDwg(database));
        } finally {
            decoder.dwg_free(pointer);
        }
    } catch {
        self.postMessage({error:'DWG файлът не можа да се прочете. Провери файла и интернет връзката.'});
    }
};
