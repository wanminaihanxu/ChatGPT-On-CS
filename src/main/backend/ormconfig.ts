import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// https://github.com/sql-js/sql.js/issues/183
import sqlite from 'sqlite3';
import { Sequelize } from 'sequelize';
import { Config, initConfig } from './entities/config';
import { initSession } from './entities/session';
import { initMessage } from './entities/message';
import { Plugin, initPlugin } from './entities/plugin';
import { initInstance } from './entities/instance';
import { Keyword, initKeyword } from './entities/keyword';
import { TransferKeyword, initTransfer } from './entities/transfer';
import { ReplaceKeyword, initReplace } from './entities/replace';

// Get user's documents directory path
const DOCUMENTS_DIR = path.join(os.homedir(), 'Documents');
const APP_DIR = path.join(DOCUMENTS_DIR, 'chatgpt-on-cs');
fs.mkdirSync(APP_DIR, { recursive: true });

// Get system's temporary directory path
const TEMP_DIR = path.join(os.tmpdir(), 'chatgpt-on-cs');
const LOGS_DIR = path.join(TEMP_DIR, 'logs');
fs.mkdirSync(LOGS_DIR, { recursive: true });

const DB_FILE_PATH = path.join(APP_DIR, 'msg.db');

console.log('DB_FILE_PATH:', DB_FILE_PATH);

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  dialectModule: sqlite,
  storage: DB_FILE_PATH,
  logging: false, // 关闭SQL日志
});

// 异步初始化和数据填充函数
async function initDb(): Promise<void> {
  try {
    // 1. 初始化所有模型
    console.log('正在初始化数据库模型...');
    initConfig(sequelize);
    initSession(sequelize);
    initMessage(sequelize);
    initKeyword(sequelize);
    initPlugin(sequelize);
    initInstance(sequelize);
    initTransfer(sequelize);
    initReplace(sequelize);

    // 2. 测试数据库连接
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // 3. 同步数据库结构
    await sequelize.sync({ force: false });
    console.log('数据库表结构同步完成');

    // 4. 初始化基础配置
    const configCount = await Config.count();
    if (configCount === 0) {
      console.log('正在初始化基础配置...');
      await Config.create({
        platform_id: '',
        instance_id: '',
        global: true,
        active: true,
        context_count: 5,
        has_keyword_match: true,
        has_transfer: true,
        has_replace: true,
        has_use_gpt: false,
        has_mouse_close: false,
        has_esc_close: false,
        has_paused: false,
      });
      console.log('基础配置初始化完成');
    }

    // 5. 初始化其他数据
    await Promise.all([
      initializeKeywords(),
      initializeTransferKeywords(),
      initializeReplaceKeywords(),
    ]);

    // 6. 清理旧版本插件
    await Plugin.destroy({
      where: {
        version: '1.0.0',
      },
    });

    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    if (error instanceof Error) {
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  }
}

// 初始化关键词
async function initializeKeywords(): Promise<void> {
  const keywordCount = await Keyword.count();
  if (keywordCount === 0) {
    console.log('正在初始化关键词...');
    const replies = [
      {
        keyword:
          '时候[and]发货|啥时[and]发货|多久[and]发货|今天[and]发货|尽快[and]发货',
        reply:
          '您好亲，我们发货是按订单顺序的发货哦。您着急的话我们会优先帮您安排的，不用担心哦。[or]您这边着急是吗，我这边备注一下。帮您先安排可以吗亲[or]懂了，您这边比较急是吗，我们先帮您安排可以吗亲。',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '你好|您好|在吗|在不|在么|在？|在?',
        reply:
          '您好，在的亲[or]亲，我在的呢[or]在的哦亲，需要点什么呢[or]在哦亲，有什么可以帮您的吗?',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '好呢|好的|好吧|行的|可以哦',
        reply: '嗯呢[or]嗯嗯[or]好呢',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '谢谢|感谢|谢了|谢你|谢您',
        reply:
          '不客气的哦亲[or]没事的呢，很荣幸能帮您[or]不用谢哦亲，应该的呢[or]不客气哦，非常荣幸为您服务哦。',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '什么[and]快递',
        reply:
          '您好，我们是随机安排的，一般来说可能根据地区稍有区别。放心时效都很快的哦。[or]亲，我们会根据您的地区选择最快时效的快递哦。您放心呢[or]亲，这个不用担心，我们会根据您的地区帮您安排运输最快速稳定的快递哦。',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '退款[and]怎么办|怎么[and]退款|退款[and]流程|退款[and]操作',
        reply:
          '亲，退款的话需要您在订单详情里申请退款哦，我们会尽快为您处理的。[or]您好，退款流程是在订单详情中提交退款申请，提交后我们会第一时间审核处理。[or]亲爱的，关于退款，您可以直接在订单里操作申请退款，有任何问题我都在这里帮您。',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '损坏|破损|有损|坏了',
        reply:
          '亲，商品损坏了真的很抱歉。麻烦您提供一下损坏的照片，我们这边帮您处理一下。[or]很抱歉给您带来不便，亲可以发一下损坏部分的照片吗？我们会尽快为您解决。[or]哦不，听闻商品有损真是让人难过，您能否提供损坏的图片呢？我们好进行下一步处理。',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '没收到货|怎么还没到|包裹[and]没到|快递[and]没收到',
        reply:
          '亲，可能是快递延误了，请您稍等一下，我这边帮您查一查物流信息。[or]很抱歉让您久等了，让我立刻为您查询快递进度，请稍候。[or]亲，有时快递会有些许延迟，我帮您看看具体情况，马上回复您。',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '优惠券|折扣|活动|促销',
        reply:
          '亲，我们店铺目前有进行促销活动哦，您可以查看我们的活动页面。[or]目前我们有提供优惠券和折扣，详细信息您可以在商品页面查看哦。[or]亲爱的，关于优惠活动，您可以在我们的促销专区看到当前所有的优惠信息哦。',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '尺码|大小|合适|不合适',
        reply:
          '亲，具体的尺码信息您可以在商品详情页找到尺码表哦，有疑问随时问我。[or]关于尺码问题，我们页面有详细的尺码对照表，您可以参考一下。[or]亲，为了确保合身，建议您根据我们提供的尺码表来选择哦。',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '账号登录问题|无法登录|忘记密码',
        reply:
          '亲，如果忘记密码，您可以尝试使用忘记密码功能来重置密码。具体操作是在登录页面选择忘记密码，按提示操作。[or]遇到登录问题，建议您先检查一下账号信息是否输入正确，如果忘记密码，可以通过忘记密码进行重置哦。[or]登录时遇到问题，不用担心，可以尝试重置密码或检查网络设置，如还有问题，随时联系我们。',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '产品质量怎么样|好用吗|耐用吗',
        reply:
          '我们的产品都是经过严格质量检验的，质量上乘，使用起来非常耐用且效果显著。[or]亲，我们的商品质量保证，收到货后如果有任何不满意都可以联系我们哦。[or]我们的产品质量非常好，很多顾客反馈使用效果很好，您可以放心购买。',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '发票问题|需要发票|怎么开发票',
        reply:
          '亲，需要开具发票的话，在下单时可以选择开具发票，并按照提示填写相关信息。具体发票问题也可以联系客服解决。[or]关于发票，我们支持电子发票和纸质发票，下单时可以根据需求选择，有问题随时联系我们。[or]开发票您不用担心，下单后在订单备注里说明，或者直接联系客服都可以办理。',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '商品有货吗|库存情况|现货吗',
        reply:
          '亲，我们的商品都是有现货的，下单后会尽快为您发货。[or]目前库存充足，您可以放心下单，我们会及时处理您的订单。[or]商品都是现货供应，您可以直接下单，我们会立即为您安排发货。',
        mode: 'fuzzy',
        platform_id: '',
      },
      {
        keyword: '颜色选择|有哪些颜色|颜色款式',
        reply:
          '亲，我们店铺的商品有多种颜色可选，具体颜色款式您可以在商品详情页查看。[or]每款商品都有多种颜色，您可以根据自己的喜好选择，详情页有展示哦。[or]关于颜色，我们提供了丰富的选择，您可以在商品页面查看所有可选的颜色哦。',
        mode: 'fuzzy',
        platform_id: '',
      },
    ];
    await Keyword.bulkCreate(replies);
    console.log('关键词初始化完成');
  }
}

// 初始化转人工关键词
async function initializeTransferKeywords(): Promise<void> {
  const transferCount = await TransferKeyword.count();
  if (transferCount === 0) {
    console.log('正在初始化转人工关键词...');
    const transfers = [
      {
        keyword: '转人工',
        has_regular: false,
      },
      {
        keyword: '人工客服',
        has_regular: false,
      },
      {
        keyword: '转人工客服',
        has_regular: false,
      },
      {
        keyword: '转人工处理',
        has_regular: false,
      },
      {
        keyword: '价格',
        has_regular: false,
      },
      {
        keyword: '退款',
        has_regular: false,
      },
      {
        keyword: '顺丰包邮',
        has_regular: false,
      },
      {
        keyword: '退货',
        has_regular: false,
      },
    ];
    await TransferKeyword.bulkCreate(transfers);
    console.log('转人工关键词初始化完成');
  }
}

// 初始化替换关键词
async function initializeReplaceKeywords(): Promise<void> {
  const replaceCount = await ReplaceKeyword.count();
  if (replaceCount === 0) {
    console.log('正在初始化替换关键词...');
    const replaces = [
      {
        keyword: '微信',
        replace: 'V兴',
        has_regular: false,
      },
      // "线下"、"电话"、"转账"、"到付"、"shua单" 淘宝、京东、微信、QQ
      {
        keyword: '线下',
        replace: 'X下',
        has_regular: false,
      },
      {
        keyword: '电话',
        replace: 'Call',
        has_regular: false,
      },
      {
        keyword: '转账',
        replace: '转Z',
        has_regular: false,
      },
      {
        keyword: '到付',
        replace: 'V付',
        has_regular: false,
      },
      {
        keyword: 'shua单',
        replace: 'V单',
        has_regular: false,
      },
    ];
    await ReplaceKeyword.bulkCreate(replaces);
    console.log('替换关键词初始化完成');
  }
}

// 立即执行初始化
initDb().catch((error) => {
  console.error('数据库初始化过程中发生错误:', error);
  process.exit(1);
});

export default sequelize;
