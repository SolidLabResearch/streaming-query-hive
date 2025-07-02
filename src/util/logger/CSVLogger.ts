import fs from 'fs';

/**
 *
 */
export class CSVLogger {

    private stream: fs.WriteStream;

    /**
     *
     * @param filePath
     */
    constructor(filePath: string) {
        this.stream = fs.createWriteStream(filePath, { flags: 'a' });
        this.stream.write('timestamp,message\n'); // Write header
    }

    /**
     *
     * @param data
     */
    log(data: any) {
        const timestamp = Date.now();
        this.stream.write(`${timestamp},${JSON.stringify(data)}\n`);
    }

    /**
     *
     */
    close() {
        this.stream.end();
    }
}