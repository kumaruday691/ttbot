const {WaterfallDialog, ComponentDialog} = require('botbuilder-dialogs');

const {ConfirmPrompt, ChoicePrompt, DateTimePrompt, NumberPrompt, TextPrompt} = require('botbuilder-dialogs');
const {DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');

const TEXT_PROMPT = "TEXT_PROMPT";
const CHOICE_PROMPT = "CHOICE_PROMPT";
const NUMBER_PROMPT = "NUMBER_PROMPT";
const DATETIME_PROMPT = "DATETIME_PROMPT";
const CONFIRM_PROMPT = "CONFIRM_PROMPT";
const WATERFALL_DIALOG = "WATERFALL_DIALOG";

var endDialog = '';

class AddTimesheetDialog extends ComponentDialog {
    constructor(conversationState, userState){
        super('addTimesheetDialog');
        this.initializeDefaultSubDialogs();
        this.initializeWaterfallDialog();
    }

    async initializeDefaultSubDialogs(){
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT, this.hoursWorkedValidator));
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
    }

    async initializeWaterfallDialog(){
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.ticketNumber.bind(this),
            this.hoursWorked.bind(this),
            this.otherDate.bind(this),
            this.confirmation.bind(this),
            this.send.bind(this) ]));
            this.initialDialogId = WATERFALL_DIALOG;
    }

    async run(turnContext, accessor, entities){
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);
        const context = await dialogSet.createContext(turnContext);

        const results = await context.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await context.beginDialog(this.id, entities);
        }
    }

    async ticketNumber(step) {
   
        if (step._info.options) {
            console.log(step._info.options)
            step.values.ticket = step._info.options.ticketNumber && step._info.options.ticketNumber[0];
            step.values.hours = step._info.options.numberOfHours && step._info.options.numberOfHours[0];
            step.values.workDate = await this.getAppropriateWorkDateFromEntities(step._info.options);
            console.log(step.values.workDate)
        }
        
        endDialog = false;
        if(!step.values.ticket) {
            return await step.prompt(TEXT_PROMPT, "Enter the full ticket number:");
        }
        else {
            return await step.continueDialog();
        }  
    }

    async getAppropriateWorkDateFromEntities(options) {
        if (!options.datetime && !options.date) {
            return undefined;
        }

        if (options.date) {
            return options.date[0];
        }

        if (options.datetime[1]) {
            return options.datetime[1].timex[0];
        }

        if (options.datetime[0]) {
            return options.datetime[0].timex[0];
        }

        return undefined;
    }

    async hoursWorked(step) {
        if (!step.values.hours) {
            return await step.prompt(NUMBER_PROMPT, `How many hours did you work on ${step.values.ticket}?`);
        }
        else {
            if (!step.values.ticket) {
                step.values.ticket = step.result;
            }
            return await step.continueDialog();
        }
    }

    async otherDate(step) {
        if (!step.values.workDate) {
            return await step.prompt(DATETIME_PROMPT, "When did you work on it?")
        }
        else {
            if (!step.values.hours) {
                step.values.hours = step.result;
            }
            return await step.continueDialog();
        }
    }

    async confirmation(step) {
        var dateString = '';
        if (!step.values.workDate) {
            step.values.workDate = step.result;
            dateString = step.values.workDate[0].value;
        }
        else {
            dateString = step.values.workDate;
        }
        var confirmationMessage = `I'm about to add ${step.values.hours} hours for ticket ${step.values.ticket} for ${dateString}.`; 
        await step.context.sendActivity(confirmationMessage)
        return await step.prompt(CONFIRM_PROMPT, "Looks good?", ['Do it', 'Wait ! What? Redo']);
    }

    async send(step) {
        if (step.result === true) {
            await step.context.sendActivity("Adding...");
            endDialog = true;
            return await step.endDialog();
        }
        else {
            endDialog = true;
            return await step.endDialog();
        }
    }

    async isDialogComplete() {
        return endDialog;
    }

    async hoursWorkedValidator(promptContext) {
        return promptContext.recognized.succeeded && promptContext.recognized.value > 0 && promptContext.recognized.value < 24;
    }
}

module.exports.AddTimesheetDialog = AddTimesheetDialog;