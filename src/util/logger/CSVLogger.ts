import fs from 'fs';

export class CSVLogger {

    private stream: fs.WriteStream;

    constructor(filePath: string) {
        this.stream = fs.createWriteStream(filePath, { flags: 'a' });
        this.stream.write('timestamp,message\n'); // Write header
    }

    log(data: any) {
        const timestamp = Date.now();
        this.stream.write(`${timestamp},${JSON.stringify(data)}\n`);
    }

    close() {
        this.stream.end();
    }
}