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

// 修改点：headless 设为 'new'，在后台静默运行，无需人工干预
const browser = await puppeteer.launch({
    headless: 'new', 
    defaultViewport: { width: 1440, height: 900 }, 
    args,
})

const [page] = await browser.pages()
const userAgent = await browser.userAgent()
await page.setUserAgent(userAgent.replace('Headless', ''))

// 依然保留录屏功能，方便在后台运行出错时查看 error.png 或 recording.webm 分析
const recorder = await page.screencast({ path: 'recording.webm' })

try {
    // --- 2. 登录流程 ---
    if (process.env.PROXY_SERVER) {
        const { username, password } = new URL(process.env.PROXY_SERVER)
        if (username && password) await page.authenticate({ username, password })
    }

    console.log('1. 正在前往 greathost.es 登录页...')
    // 【修改点 1】网址
    await page.goto('https://greathost.es/login', { waitUntil: 'networkidle2', timeout: 60000 })
    
    // 【修改点 2】账号 (input#email)
    console.log('-> 正在输入账号...')
    await page.waitForSelector('input#email', { timeout: 15000 })
    await page.type('input#email', process.env.EMAIL) 
    
    // 【修改点 3】密码 (input#password)
    console.log('-> 正在输入密码...')
    await page.type('input#password', process.env.PASSWORD)
    
    // 【修改点 4】登录按钮 (button.btn)
    console.log('2. 点击登录按钮...')
    await page.waitForSelector('button.btn')
    
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
        page.click('button.btn')
    ])
    
    console.log('3. 页面跳转完成，登录流程结束。')
    console.log('✅ 脚本执行完毕！')

} catch (e) {
    console.error('❌ 发生错误:', e)
    // 截图保存错误现场
    await page.screenshot({ path: 'error_greathost.png', fullPage: true })
    process.exitCode = 1
} finally {
    await setTimeout(2000)
    await recorder.stop()
    await browser.close()
}
