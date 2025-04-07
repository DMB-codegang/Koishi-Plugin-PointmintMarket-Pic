import { Context, Schema, Logger } from 'koishi'
import * as jsonpath from 'jsonpath'
import { MarketService, MarketItemRegisterOptions } from 'koishi-plugin-pointmintmarket'

// 插件配置
export interface Config {
  /** http请求超时时间 */
  timeout: number
  /** API配置 */
  apiList: Array<{
    /** API对应的商品名称 */
    name: string
    /** 商品详细描述 */
    description: string
    /** 商品展示图URL */
    tags: string[]
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
      name: Schema.string().description('商品名称（唯一）'),
      description: Schema.string().role('textarea', { rows: [2, 2] }).description('默认商品描述'),
      tags: Schema.array(Schema.string()).description('默认关键词标签')
    }).description('API配置 - 基础设置'),
    Schema.object({
      url: Schema.string().role('link').description('完整的API请求地址'),
      method: Schema.union(['GET', 'POST']).default('GET').description('HTTP 请求方法'),
      response: Schema.string().description('配置解析的JSON路径，可通过[🔗*JSONPath Online Evaluator*](https://jsonpath.com/)测试，保持空值将会直接将链接的图片直接发送')
    }).description('API配置 - API设置')
  ])
  ).description('API配置'),
  debug: Schema.boolean()
    .default(false)
    .description('是否启用调试日志')
})

declare module 'koishi' {
  interface Context {
    market: MarketService
  }
}


export const name = 'pointmintmarket-pic'
export const inject = ['market', 'http']


export function apply(ctx: Context, config: Config) {
  const logger = new Logger(ctx.name)

  // 在插件启动时注册示例商品
  ctx.on('ready', async () => {
    await ctx.market.unregisterItems(ctx.name)
    await registerExampleItems()
  })

  ctx.on('dispose', async () => {
    await ctx.market.unregisterItems(ctx.name)
  })

  // 注册示例商品
  async function registerExampleItems() {
    try {
      // 注册用户配置的商品
      for (const api of config.apiList) {
        const item: MarketItemRegisterOptions = {
          name: api.name,
          description: api.description,
          tags: api.tags,
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
        ctx.market.registerItem(ctx.name, item)
      }
    } catch (error) {
      logger.error('注册示例商品时出错:', error)
    }
  }
}