import { IsEmail, IsIn, IsString } from "class-validator";

export default class EmailActionsDto{
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email: string;

    @IsString()
    @IsIn(['VERIFY', 'RESET'], { message: 'emailType must be VERIFY or RESET' })
    emailType: string;
}