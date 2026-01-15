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

// 保持无头模式
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

    console.log('1. [登录] 正在前往 greathost.es...')
    await page.goto('https://greathost.es/login', { waitUntil: 'networkidle2', timeout: 60000 })
    
    // 输入账号
    await page.waitForSelector('input#email', { timeout: 15000 })
    await page.type('input#email', process.env.EMAIL) 
    
    // 输入密码
    await page.type('input#password', process.env.PASSWORD)
    
    // 点击登录
    await page.waitForSelector('button.btn')
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
        page.click('button.btn')
    ])
    console.log('2. [登录成功] Dashboard 加载完毕。')

    // --- 3. 连续点击操作流程 ---

    // 步骤 A: 点击 Billing
    console.log('3. [操作] 寻找并点击 Billing (a.btn-billing-compact)...')
    await page.waitForSelector('a.btn-billing-compact', { visible: true, timeout: 15000 })
    // 使用 evaluate 点击以防被遮挡
    await page.$eval('a.btn-billing-compact', el => el.click());
    
    // 步骤 B: 点击 View
    console.log('4. [操作] 寻找并点击 View (a.btn-view)...')
    // 确保 View 按钮出现
    await page.waitForSelector('a.btn-view', { visible: true, timeout: 15000 })
    // 稍微等待一下动画
    await setTimeout(1000)
    await page.$eval('a.btn-view', el => el.click());

    // 步骤 C: 点击 Renew (修复报错的关键步骤)
    console.log('5. [操作] 寻找并点击 Renew (button#renew-free-server-btn)...')
    const renewBtnSelector = 'button#renew-free-server-btn'
    
    // 等待按钮出现在 DOM 中并且可见
    await page.waitForSelector(renewBtnSelector, { visible: true, timeout: 15000 })
    
    // ⚠️ 关键修改：等待 2 秒，防止页面刚加载有 loading 遮罩
    await setTimeout(2000)
    
    // ⚠️ 关键修改：使用 $eval 执行原生 JS 点击 (强力点击)，绕过 "not clickable" 错误
    await page.$eval(renewBtnSelector, el => el.click())
    
    console.log('-> ✅ 已强制点击 Renew 按钮！')

    // --- 4. 结束处理 ---
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
