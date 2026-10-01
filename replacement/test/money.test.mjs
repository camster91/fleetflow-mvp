import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceCost,formatCost} from '../src/public/money.js';
test('Service costs use currency decimal precision and preserve exact large report totals',()=>{
 assert.equal(serviceCost('123.45','CAD'),12345);assert.equal(serviceCost('12','JPY'),12);assert.equal(serviceCost('1.234','BHD'),1234);assert.equal(serviceCost('0','CAD'),0);
 assert.equal(formatCost('9007199254740993123','CAD'),'CAD 90,071,992,547,409,931.23');assert.equal(formatCost('12','JPY'),'JPY 12');assert.equal(formatCost('1234','BHD'),'BHD 1.234');
 for(const [amount,currency]of [['-1','CAD'],['1.001','CAD'],['1.1','JPY'],['1e3','CAD'],['10000001','CAD'],['1','ZZZ']])assert.throws(()=>serviceCost(amount,currency));
});
