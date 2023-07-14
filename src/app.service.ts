import { Injectable } from '@nestjs/common';
import { VK } from 'vk-io';
import { Cron } from '@nestjs/schedule';
import * as https from 'https';

@Injectable()
export class AppService {
  private vk: VK;

  constructor() {
    this.vk = new VK({
      token:
        'vk1.a.5cLvNW-YUVmtpsPcCotF2l7IdI7ofG8Ne_HSlRdEKmFTiIo4KmbTcs2LX7_ZrttS1mHbJRKirbmDctveB-CroX-WFUBjYUaRMy1gPxVEfuy6-2rEgdx6B--jS47NAnafDn7FojRs1bVuP9ySHEON0SbA_qMmPdqL7Fu401zqhIqXfN7YCJ5tTKyU40PfV7yoYbb3V9lqh7thQG1EBv4gCA',
    });
  }

  onModuleInit() {
    this.vk.updates.on('message_new', async (context) => {
      console.log(context.text);
    });

    this.vk.updates
      .startPolling()
      .then(() => {
        console.log('Bot started');
      })
      .catch(console.error);
  }

  async sendHello(screenName: string, message: string) {
    const userId = await this.getUserId(screenName);
    const randomId = Math.floor(Math.random() * 1e9);
    return await this.vk.api.messages.send({
      user_id: userId,
      random_id: randomId,
      message: message,
    });
  }

  async getUserId(screenName: string) {
    const response = await this.vk.api.utils.resolveScreenName({
      screen_name: screenName,
    });
    return response.object_id;
  }

  @Cron('0 */3 * * *')
  async sendWeatherForecast() {
    const userId = await this.getUserId('spectrages');
    const city = 'Minsk';
    const forecast = await this.getWeatherForecast(city);
    await this.vk.api.messages.send({
      user_id: userId,
      random_id: Math.floor(Math.random() * 1e9),
      message: forecast,
    });
  }

  async getWeatherForecast(city: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&lang=ru&APPID=c730f4e326f996062eceab65f7cd5945&units=metric`;
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
            resolve(
              `Текущая погода в ${city}: ${weather}, температура: ${temperature.toFixed(
                0,
              )}°C`,
            );
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }
}
