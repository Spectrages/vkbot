import { Controller, Get } from '@nestjs/common';
import { Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  async sendHello(@Body() body: { screenName: string; message: string }) {
    return await this.appService.sendMessage(body.screenName, body.message);
  }

  @Post('/all')
  async sendAll(@Body() body: { message: string }) {
    return await this.appService.sendMessageForAll(body.message);
  }

  @Get()
  async sendWeather() {
    return await this.appService.sendWeatherForecast();
  }

  @Get('/course')
  async cources() {
    return await this.appService.sendCourseData();
  }
}
