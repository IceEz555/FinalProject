const { dynamoDocClient, s3 } = require("./aws-connections"); // import clients จาก aws-connections.js
const { config } = require("./config");
const { QueryCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
// สำหรับ AWS SDK v3: Import Commands ที่จำเป็น
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3"); // สำหรับ s3.putObject และ s3.getObject

module.exports.getYesterdayDate = function () {
  const yesterday = new Date();
  yesterday.setHours(0);
  yesterday.setMinutes(0);
  yesterday.setSeconds(0);
  yesterday.setDate(yesterday.getDate() - 1);

  const string = yesterday.toISOString().substring(0, 10).replace(/-/g, "");

  return {
    dateObj: yesterday,
    unixTimestamp: parseInt(yesterday.getTime() / 1000),
    string: string,
    year: string.substring(0, 4),
    month: string.substring(4, 6),
    day: string.substring(6, 8),
  };
};

module.exports.getTodaysDate = function () {
  const today = new Date();
  today.setHours(0);
  today.setMinutes(0);
  today.setSeconds(0);

  const string = today.toISOString().substring(0, 10).replace(/-/g, "");

  return {
    dateObj: today,
    unixTimestamp: parseInt(today.getTime() / 1000),
    string: string,
    year: string.substring(0, 4),
    month: string.substring(4, 6),
    day: string.substring(6, 8),
  };
};

module.exports.parseDynamoDBReadingsToJson = function (data) {
  const output = [];

  for (const entry of data.Items) {
    const timestamp = entry.sortkey;
    const readings = entry.readings;

    let timeForEntry = entry.sortkey - readings.length - 2;

    for (const reading of readings) {
      output.push({
        timestamp: timeForEntry,
        reading: reading,
      });

      timeForEntry++;
    }
  }

  return output;
};

module.exports.parseDynamoDBItemsToCSV = function (dynamoData) {
  let output = "Timestamp,Watts\n";

  const json = module.exports.parseDynamoDBReadingsToJson(dynamoData);

  for (const reading of json) {
    output += reading.timestamp + "," + reading.reading + "\n";
  }

  return output;
};

module.exports.getReadingsFromDynamoDBSince = async function (
  deviceId,
  timestamp
) {
  const { dynamoDocClient } = require('./aws-connections');
  const { config } = require('./config');

  const params = {
    TableName: config.dynamoDb.table,
    KeyConditionExpression: "#key = :key and #sortkey > :timestamp",
    ScanIndexForward: true, 
    ConsistentRead: false,
    ExpressionAttributeNames: {
      "#key": "primarykey",
      "#sortkey": "sortkey",
    },
    ExpressionAttributeValues: {
      ":key": "reading-" + deviceId,
      ":timestamp": timestamp,
    },
  };
  const data = await dynamoDocClient.send(new QueryCommand(params));

  return module.exports.parseDynamoDBReadingsToJson(data);
};

// +++ START: เพิ่มฟังก์ชันใหม่สำหรับปุ่ม Yesterday +++
module.exports.getReadingsFromDynamoDBByDateRange = async function (
  deviceId,
  startDate,
  endDate
) {
  const params = {
    TableName: config.dynamoDb.table,
    KeyConditionExpression: "#key = :key and #sortkey BETWEEN :start AND :end",
    ScanIndexForward: true,
    ConsistentRead: false,
    ExpressionAttributeNames: {
      "#key": "primarykey",
      "#sortkey": "sortkey",
    },
    ExpressionAttributeValues: {
      ":key": "reading-" + deviceId,
      ":start": startDate,
      ":end": endDate,
    },
  };

  // เพิ่มโค้ดดีบักเพื่อช่วยตรวจสอบปัญหา
  console.log('[DEBUG] Querying DynamoDB for historical readings with params:', JSON.stringify(params, null, 2));
  
  try {
    const data = await dynamoDocClient.send(new QueryCommand(params));
    console.log('[DEBUG] DynamoDB returned item count:', data.Items ? data.Items.length : 0);
    return module.exports.parseDynamoDBReadingsToJson(data);
  } catch (error) {
    console.error('[ERROR] Failed to query DynamoDB for historical readings:', error);
    return []; // ส่งค่าว่างกลับไปหากเกิดข้อผิดพลาด
  }
};
// +++ END: ฟังก์ชันใหม่สำหรับปุ่ม Yesterday +++


module.exports.getUsageDataFromDynamoDB = async function (
  deviceId,
  startDate,
  endDate
) {
  const { dynamoDocClient } = require('./aws-connections');
  const { config } = require('./config');

  const params = {
    TableName: config.dynamoDb.table,
    KeyConditionExpression: "#key = :key and #sortkey BETWEEN :start AND :end",
    ScanIndexForward: true,
    ConsistentRead: false,
    ExpressionAttributeNames: {
      "#key": "primarykey",
      "#sortkey": "sortkey",
    },
    ExpressionAttributeValues: {
      ":key": "summary-day-" + deviceId,
      ":start": startDate,
      ":end": endDate,
    },
  };
  const data = await dynamoDocClient.send(new QueryCommand(params));

  console.log(data);
  return data.Items;
};

module.exports.writeToS3 = async function (filename, contents) {
  const { s3 } = require('./aws-connections');
  const { config } = require('./config');
  const util = require("util");
  const zlib = require("zlib");
  const gzip = util.promisify(zlib.gzip);

  const compressedBody = await gzip(contents);

  const params = {
    Body: compressedBody,
    Bucket: config.s3.bucket,
    Key: filename + ".gz",
  };
  return s3.send(new PutObjectCommand(params));
};

module.exports.readFromS3 = function (filename) {
  const { s3 } = require('./aws-connections');
  const { config } = require('./config');

  const params = {
    Bucket: config.s3.bucket,
    Key: filename,
  };
  return s3.send(new GetObjectCommand(params));
};

module.exports.getDatesBetween = function (startDate, endDate) {
  const dateArray = [];

  let currentDate = startDate;
  while (currentDate <= endDate) {
    dateArray.push(new Date(currentDate));
    currentDate = currentDate.addDays(1); // โค้ดส่วนนี้ยังคงมี Bug อยู่ตามที่คุณต้องการ
  }

  return dateArray;
};

module.exports.writeToDynamoDB = function (tableName, object) {
  const { dynamoDocClient } = require('./aws-connections');
  const { PutCommand } = require("@aws-sdk/lib-dynamodb");

  const params = {
    TableName: tableName,
    Item: object,
  };
  return dynamoDocClient.send(new PutCommand(params));
};
