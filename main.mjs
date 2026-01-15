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

    console.log('1. [登录] 正在前往 greathost.es...')
    await page.goto('https://greathost.es/login', { waitUntil: 'networkidle2', timeout: 60000 })
    
    console.log('-> 输入账号...')
    await page.waitForSelector('input#email', { timeout: 15000 })
    await page.type('input#email', process.env.EMAIL) 
    
    console.log('-> 输入密码...')
    await page.type('input#password', process.env.PASSWORD)
    
    console.log('-> 点击登录...')
    await page.waitForSelector('button.btn')
    
    // 登录并等待页面跳转
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
        page.click('button.btn')
    ])
    console.log('2. [登录成功] Dashboard 加载完毕。')

    // --- 3. 连续点击操作流程 ---

    // 步骤 A: 点击 Billing 按钮
    console.log('3. [操作] 寻找并点击 Billing (a.btn-billing-compact)...')
    await page.waitForSelector('a.btn-billing-compact', { timeout: 15000 })
    
    // 因为是链接跳转，点击后最好等待一下网络空闲，或者直接等待下一个元素出现
    await page.click('a.btn-billing-compact')
    
    // 步骤 B: 点击 View 按钮
    // 必须等待 View 按钮出现，这证明页面已经跳转到了列表页
    console.log('4. [操作] 寻找并点击 View (a.btn-view)...')
    await page.waitForSelector('a.btn-view', { timeout: 15000 })
    await page.click('a.btn-view')

    // 步骤 C: 点击 Renew 按钮
    // 必须等待 Renew 按钮出现，这证明页面已经跳转到了详情页
    console.log('5. [操作] 寻找并点击 Renew (button#renew-free-server-btn)...')
    const renewBtnSelector = 'button#renew-free-server-btn'
    await page.waitForSelector(renewBtnSelector, { timeout: 15000 })
    
    // 点击续费
    await page.click(renewBtnSelector)
    console.log('-> ✅ 已点击 Renew 按钮！')

    // --- 4. 结束处理 ---
    // 等待几秒，确保续费请求发送成功（如果有弹窗提示成功，也可以加逻辑去捕获）
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
