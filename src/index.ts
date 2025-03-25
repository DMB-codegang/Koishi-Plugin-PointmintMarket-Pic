import { Context, Schema, Logger } from 'koishi'
import * as jsonpath from 'jsonpath'
import { MarketService, MarketItemRegisterOptions } from 'koishi-plugin-pointmintmarket'

// 插件配置
export interface Config {
  /** http请求超时时间 */
  timeout: number
  /** API配置 */
  apiList: Array<{
    /** 商品ID */
    id: string
    /** API对应的商品名称 */
    name: string
    /** 商品详细描述 */
    description: string
    /** 商品定价 */
    price: number
    /** 商品展示图URL */
    tags: string[]
    /** 初始库存设置 */
    stock: number
    /** API的URL */
    url: string
    /** API的请求方法 */
    method: "GET" | "POST"
    /** API的响应数据路径 */
    response: string // 响应的JSON路径
  }>
  /** 是否启用调试日志 */
  debug: boolean
}

export const Config: Schema<Config> = Schema.object({
  timeout: Schema.number().default(5000).min(1000).description('http请求超时时间，单位为毫秒，此值不影响获取图片的时间'),
  apiList: Schema.array(
    Schema.intersect([
    Schema.object({
      id: Schema.string().description('商品ID'),
      name: Schema.string().description('此api对应的商品名称'),
      description: Schema.string().role('textarea', { rows: [2, 2] }).description('商品详细描述'),
      price: Schema.number().default(10).min(1).description('商品定价'),
      tags: Schema.array(Schema.string()).description('搜索关键词标签'),
      stock: Schema.number().description('初始库存设置')
    }).description('API配置 - 基础设置'),
    Schema.object({
      url: Schema.string().description('完整的API请求地址\n示例: `https://api.example.com/data`'),
      method: Schema.union(['GET', 'POST']).default('GET').description('HTTP 请求方法'),
      response: Schema.string().description('配置解析的JSON路径\n示例: `data.items[0].name`')
    }).description('API配置 - API设置')
  ])
  ).description('API配置'),
  debug: Schema.boolean()
    .default(false)
    .description('是否启用调试日志')
})

export const name = 'pointmintmarket-example'
export const description = '积分商城示例插件 - 展示如何使用积分商城API'

declare module 'koishi' {
  interface Context {
    market: MarketService
  }
}

// 依赖pointmintmarket插件
export const inject = ['market', 'http']

export function apply(ctx: Context, config: Config) {
  const logger = new Logger('pointmintmarket-example')

  // 在插件启动时注册示例商品
  ctx.on('ready', async () => {
    await registerExampleItems()
    logger.info('示例商品已注册')
  })

  // 注册示例商品
  async function registerExampleItems() {
    try {
      // 注册用户配置的商品
      for (const api of config.apiList) {
        const item: MarketItemRegisterOptions = {
          id: api.id,
          name: api.name,
          description: api.description,
          price: api.price,
          tags: api.tags,
          stock: api.stock,
          // 购买回调函数
          onPurchase: async (session) => {
            try {
              if (!api.response) {
                session.send(`<img src="${api.url}"/>`)
                return { code: 200, msg: '兑换成功', data: { itemType: 'api' } }
              }
              let data;
              // 确定请求方法
              if (api.method === 'GET'){
                data = await ctx.http.get(api.url, { timeout: config.timeout })
              } else {
                data = await ctx.http.post(api.url, { timeout: config.timeout })
              }
              // 使用配置项中的路径解析响应数据
              const result = jsonpath.query(data, api.response)
              // 发送响应数据
              await session.send(`<img src="${result[0]}"/>`)
              return { code: 200, msg: '兑换成功', data: { itemType: 'api' } }
            } catch (error) {
              logger.error('兑换示例商品时出错:', error)
              return { code: 500, msg: '兑换失败', data: { itemType: 'api' } }
            }
          }
        }
        ctx.market.registerItem(api.name, item)
      }
    } catch (error) {
      logger.error('注册示例商品时出错:', error)
    }
  }
}