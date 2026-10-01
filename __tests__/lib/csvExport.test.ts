/**
 * @jest-environment jsdom
 */
import { downloadCSV } from '@/lib/csvExport'

test('quotes every cell and neutralises spreadsheet formulas', () => {
  let text = ''
  const RealBlob = global.Blob
  global.Blob = class {
    constructor(parts: string[]) {
      text = parts.join('')
    }
  } as unknown as typeof Blob
  const createObjectURL = jest.fn(() => 'blob:x')
  Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() })
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

  downloadCSV('vehicle-load', [
    { name: '=HYPERLINK("https://evil.example","Click")', deliveries: 3 },
    { name: 'Van, north', deliveries: 1 },
    { name: ' @SUM(A1)', deliveries: 0 },
    { name: '|cmd', deliveries: 2 },
  ])

  global.Blob = RealBlob
  expect(text.split('\n')).toEqual([
    '"name","deliveries"',
    '"\'=HYPERLINK(""https://evil.example"",""Click"")","3"',
    '"Van, north","1"',
    '"\' @SUM(A1)","0"',
    '"\'|cmd","2"',
  ])
  expect(click).toHaveBeenCalled()
})
