import { AppService } from "./app.service";
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHello(): {
        message: string;
    };
    healthCheck(): {
        status: string;
        timestamp: string;
        service: string;
    };
}
