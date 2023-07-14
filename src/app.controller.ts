import { Controller } from '@nestjs/common';
import { Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  sendHello(@Body() body: { screenName: string; message: string }) {
    return this.appService.sendHello(body.screenName, body.message);
  }
}
