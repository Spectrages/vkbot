import { Injectable, Logger } from '@nestjs/common';
import { VK, UpdateSource, Keyboard } from 'vk-io';
import { Cron, Interval } from '@nestjs/schedule';
import * as https from 'https';
const cheerio = require('cheerio');
import axios from 'axios';
import { Buttons, kickAnswers } from './types';
import { translateDescription } from './utils/translations';
import { degreesToDirection } from './utils/deegresConverter';

@Injectable()
export class AppService {
  private vk: VK;
  private users: string[];
  private accessToken: string;
  private readonly logger = new Logger(AppService.name);

  constructor() {
    this.vk = new VK({
      token:
        'vk1.a.kr8IVRrCPebrM5Mh1494FEP_qWItALnMzgK8Cq9B_IEqoCjts6ofBmcDZtlZRz-tWINnlk8vEiqgU_zEOnn_duIGRBG59eH6FY1SRl9LFh6qwZEyOFZhyOOdsOAEtmDfRMiNWhSSIMNzKHBwvlGA6iLR3UbdME4_CLbHCnzh1j0FWb4ve2ylkhyERbLE2DUV-iVxp8k0Jpg_td2bsY7Sqg',
    });

    this.users = ['spectrages', 'snusmumrick', 'schweppeses'];
    //'just_stereotype',
    //'schweppeses',
    this.accessToken = 'fb0af6778b3272bc348ce1852ee238b7';
  }

  onModuleInit() {
    const users = new Map();
    this.vk.updates.on('message_new', async (context) => {
      if (context.messagePayload) {
        const payload = JSON.parse(context.messagePayload);
        switch (payload.button) {
          case Buttons.Weather:
            const forecast = await this.getWeatherForecast('Minsk');
            await this.sendInfoToUser(context.senderId, forecast);
            users.set(context.senderId, false);
            break;
          case Buttons.Cources:
            const currentCourse = await this.fetchExchangeRates();
            await this.sendInfoToUser(context.senderId, currentCourse);
            users.set(context.senderId, false);
            break;
          case Buttons.Kick:
            const message =
              kickAnswers[Math.floor(Math.random() * kickAnswers.length)];
            await this.sendInfoToUser(context.senderId, message);
            users.set(context.senderId, false);
            break;
        }
      } else {
        if (!users.get(context.senderId)) {
          await context.send({
            message: 'Абярыце каманду',
            keyboard: Keyboard.builder()
              .inline(true)
              .textButton({
                label: `Надвор'е`,
                payload: JSON.stringify({ button: Buttons.Weather }),
                color: Keyboard.PRIMARY_COLOR,
              })
              .textButton({
                label: `Курсы валют`,
                payload: JSON.stringify({ button: Buttons.Cources }),
                color: Keyboard.PRIMARY_COLOR,
              })
              .textButton({
                label: `Штурхнуць`,
                payload: JSON.stringify({ button: Buttons.Kick }),
                color: Keyboard.SECONDARY_COLOR,
              }),
          });
          users.set(context.senderId, true);
        }
      }
    });

    this.vk.updates
      .startPolling()
      .then(() => {
        console.log('Bot restarted');
      })
      .catch(console.error);
  }

  @Interval(840000)
  executeTask() {
    this.logger.debug('Executing task every 14 minutes');
    console.log('Hello');
  }

  async sendMessage(screenName: string, message: string) {
    const userId = await this.getUserId(screenName);
    const randomId = Math.floor(Math.random() * 1e9);
    return await this.vk.api.messages.send({
      user_id: userId,
      random_id: randomId,
      message: message,
    });
  }

  async sendMessageForAll(message: string) {
    return await this.users.forEach(async (screenName: string) => {
      const userId = await this.getUserId(screenName);
      await this.vk.api.messages.send({
        user_id: userId,
        random_id: Math.floor(Math.random() * 1e9),
        message: message,
      });
    });
  }

  async getUserId(screenName: string) {
    const response = await this.vk.api.utils.resolveScreenName({
      screen_name: screenName,
    });
    return response.object_id;
  }

  async sendInfoToUser(userId: number, message: string) {
    await this.vk.api.messages.send({
      user_id: userId,
      random_id: Math.floor(Math.random() * 1e9),
      message: message,
    });
  }

  @Cron('0 */3 * * *')
  async sendWeatherForecast() {
    const city = 'Minsk';
    const forecast = await this.getWeatherForecast(city);
    return await this.users.forEach(async (screenName: string) => {
      const userId = await this.getUserId(screenName);
      await this.vk.api.messages.send({
        user_id: userId,
        random_id: Math.floor(Math.random() * 1e9),
        message: forecast,
      });
    });
  }

  @Cron('0 12 * * *')
  async sendCourseData() {
    const currentCourse = await this.fetchExchangeRates();
    return await this.users.forEach(async (screenName: string) => {
      const userId = await this.getUserId(screenName);
      await this.vk.api.messages.send({
        user_id: userId,
        random_id: Math.floor(Math.random() * 1e9),
        message: currentCourse,
      });
    });
  }

  async fetchExchangeRates() {
    const url = 'https://admin.myfin.by/outer/informer/minsk/sub/small';
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      const rows = $('tr.bordered, tr:not(.bordered)');

      const formattedData = rows
        .map((index, row) => {
          if (index === 1) {
            return null;
          }
          const columns = $(row).find('td');
          const values = columns
            .map((index, column) => $(column).text().trim())
            .get();
          if (values.length === 3) {
            return `${values[0]}: Купля/Продаж — ${values[1]}/${values[2]}`;
          } else {
            return values.join(' ');
          }
        })
        .get()
        .filter(Boolean)
        .join('\n');

      return formattedData;
    } catch (error) {
      throw error;
    }
  }

  async getWeatherForecast(city: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&lang=eng&APPID=c730f4e326f996062eceab65f7cd5945&units=metric`;
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            const response = JSON.parse(data);
            const weather = response.weather[0].description;
            const temperature = response.main.temp;
            const windSpeed = response.wind.speed;
            const windDirection = degreesToDirection(response.wind.deg);
            const humidity = response.main.humidity;
            // const minTemp = response.main.temp_min;
            // const maxTemp = response.main.temp_max;
            resolve(
              `Бягучае надвор'е ў горадзе Менск: ${translateDescription(
                weather,
              )},\n` +
                `Тэмпература: ${temperature.toFixed(1)}°C,\n` +
                `Хуткасць ветру: ${windSpeed} м/с,\n` +
                `Напрамак ветру: ${windDirection},\n` +
                `Вільготнасць: ${humidity}%,\n`,
              // `Мінімальная тэмпература: ${minTemp.toFixed(1)}°C,\n` +
              // `Максімальная тэмпература: ${maxTemp.toFixed(1)}°C`,
            );
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }
}
