const { getReadingsFromDynamoDBByDateRange } = require('../../../core/helpers');
const { config } = require('../../../core/config');

/**
 * @param {int} startDate   Start timestamp in seconds
 * @param {int} endDate     End timestamp in seconds
 */
module.exports.readings = async ({ startDate, endDate }) => {

    console.log('[DEBUG] "readings" resolver called with:');
    console.log(`  -> startDate: ${startDate} (${new Date(startDate * 1000)})`);
    console.log(`  -> endDate: ${endDate} (${new Date(endDate * 1000)})`);

    // ใช้ฟังก์ชันใหม่ที่เราเพิ่งสร้างใน helpers.js
    return await getReadingsFromDynamoDBByDateRange(
        config.deviceName,
        startDate,
        endDate
    );
}