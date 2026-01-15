import puppeteer from 'puppeteer'
import { setTimeout } from 'node:timers/promises'

// --- 1. 浏览器启动配置 ---
const args = ['--no-sandbox', '--disable-setuid-sandbox']
if (process.env.PROXY_SERVER) {
    const proxy_url = new URL(process.env.PROXY_SERVER)
    proxy_url.username = ''
    proxy_url.password = ''
    args.push(`--proxy-server=${proxy_url}`.replace(/\/$/, ''))
}

// 保持无头模式（后台运行）
const browser = await puppeteer.launch({
    headless: 'new', 
    defaultViewport: { width: 1440, height: 900 }, 
    args,
})

const [page] = await browser.pages()
const userAgent = await browser.userAgent()
await page.setUserAgent(userAgent.replace('Headless', ''))

const recorder = await page.screencast({ path: 'recording.webm' })

try {
    // --- 2. 登录流程 ---
    if (process.env.PROXY_SERVER) {
        const { username, password } = new URL(process.env.PROXY_SERVER)
        if (username && password) await page.authenticate({ username, password })
    }

    console.log('1. 正在前往 greathost.es 登录页...')
    await page.goto('https://greathost.es/login', { waitUntil: 'networkidle2', timeout: 60000 })
    
    console.log('-> 正在输入账号...')
    await page.waitForSelector('input#email', { timeout: 15000 })
    await page.type('input#email', process.env.EMAIL) 
    
    console.log('-> 正在输入密码...')
    await page.type('input#password', process.env.PASSWORD)
    
    console.log('2. 点击登录按钮...')
    await page.waitForSelector('button.btn')
    
    // 点击登录并等待跳转
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
        page.click('button.btn')
    ])
    console.log('3. 登录成功，Dashboard 加载完毕。')

    // --- 3. 修改点：点击 a.btn-billing-compact ---
    console.log('4. 正在寻找按钮 (a.btn-billing-compact)...')
    const targetBtnSelector = 'a.btn-billing-compact'

    // 等待按钮出现
    await page.waitForSelector(targetBtnSelector, { timeout: 15000 })

    // 点击按钮 (默认点击找到的第一个)
    // 如果这个按钮会触发跳转，建议保留下面的 setTimeout 或加 waitForNavigation
    await page.click(targetBtnSelector)
    console.log('-> 已点击 a.btn-billing-compact 按钮！')

    // 等待 5 秒，确保操作生效
    await setTimeout(5000)

    console.log('✅ 所有流程执行完毕！')

} catch (e) {
    console.error('❌ 发生错误:', e)
    await page.screenshot({ path: 'error_greathost.png', fullPage: true })
    process.exitCode = 1
} finally {
    await setTimeout(2000)
    await recorder.stop()
    await browser.close()
}
