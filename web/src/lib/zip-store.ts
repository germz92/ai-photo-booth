function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(date: Date) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() / 2) & 0x1f);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function writeHeader(
  signature: number,
  name: Uint8Array,
  crc: number,
  size: number,
  offset: number | null,
  time: number,
  day: number,
) {
  const length = signature === 0x02014b50 ? 46 + name.length : 30 + name.length;
  const header = Buffer.alloc(length);
  header.writeUInt32LE(signature, 0);
  if (signature === 0x02014b50) {
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(time, 12);
    header.writeUInt16LE(day, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(size, 20);
    header.writeUInt32LE(size, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(offset ?? 0, 42);
    name.forEach((byte, index) => header.writeUInt8(byte, 46 + index));
    return header;
  }
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(day, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  name.forEach((byte, index) => header.writeUInt8(byte, 30 + index));
  return header;
}

export type ZipEntry = {
  name: string;
  data: Uint8Array;
};

export async function* storedZipParts(entries: AsyncIterable<ZipEntry>) {
  const now = dosTime(new Date());
  const central: Buffer[] = [];
  let offset = 0;
  let count = 0;
  for await (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/[\\/]/g, "-"), "utf8");
    const crc = crc32(entry.data);
    const local = writeHeader(0x04034b50, name, crc, entry.data.length, null, now.time, now.day);
    central.push(writeHeader(0x02014b50, name, crc, entry.data.length, offset, now.time, now.day));
    offset += local.length + entry.data.length;
    count += 1;
    yield local;
    yield Buffer.from(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  yield directory;
  yield end;
}
