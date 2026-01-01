import { IsString } from "class-validator";

export default class EmailActionsDto{
    @IsString()
    email: string;

    @IsString()
    emailType: string;
}