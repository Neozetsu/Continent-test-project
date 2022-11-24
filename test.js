import iconv from 'iconv-lite'
import fetch from 'node-fetch'
import AdmZip from 'adm-zip'
import fs from 'fs'

const zipName = 'temp.zip'
const url = 'http://www.cbr.ru/s/newbik'

function BICParser() {
    return new Promise(async (resolve, reject) => {
        const res = await fetch(url)
        const ws = fs.createWriteStream(zipName)
        res.body.pipe(ws)
        ws.on('error', () => {
            reject('Не удалось считать файл архива')
        })
        ws.on('finish', () => {
            ws.close()

            const zip = new AdmZip(zipName)
            const [ file ] = zip.getEntries()
            const fileName = file.name
            zip.extractAllTo('.', true)

            let xmlString = ''
            const rs = fs.createReadStream(fileName)
            const converterStream = iconv.decodeStream('win1251')
            rs.pipe(converterStream)
            converterStream.on('error', () => {
                fs.unlinkSync(fileName)
                fs.unlinkSync(zipName)
                reject('Не удалось расшифровать файл')
            })
            converterStream.on('data', function(str) {
                xmlString += str;
            })
            converterStream.on('end', () => {
                fs.unlinkSync(fileName)
                fs.unlinkSync(zipName)
                resolve(xmlParser(xmlString))
            })
        })
    })
}

function xmlParser(xmlString) { 
    const parsedStr = xmlString.split('<BICDirectoryEntry').slice(1)
    const data = parsedStr.flatMap(str => {
        const bik = str.match(/ BIC="(\S*)"/).at(1)
        const nameP = str.match(/ NameP="(.*?)" /).at(1).replaceAll('&quot;', '"')
        const arrAccounts = str.match(/ Account="(\S*)" /g)
        if (arrAccounts) {
            const account = arrAccounts.map(str => str.split('"').at(1))
            return account.map(acc => ({
                bik: Number(bik),
                nameP: nameP,
                acc: Number(acc)
            }))
        }
    }).filter(d => d !== undefined)
    return data;
}

BICParser().then(data => console.log(data))
