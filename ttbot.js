// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { AddTimesheetDialog } = require('./componentDialogs/addTimesheetDialog');
const { LuisRecognizer, QnAMaker } = require('botbuilder-ai');

class TTBot extends ActivityHandler {
    constructor(converstationState, userState) {
        super();

        this.converstationState = converstationState;
        this.userState = userState;

        this.dialogState = converstationState.createProperty("dialogState");
        this.addTimesheetDialog = new AddTimesheetDialog(this.converstationState, this.userState);

        this.previousIntent = this.converstationState.createProperty("previousIntent");
        this.converstationData = this.converstationState.createProperty("conversationData");

        const dispatchRecognizer = new LuisRecognizer({
            applicationId: process.env.LuisAppId,
            endpointKey: process.env.LuisAPIKey,
            endpoint: `https://${process.env.LuisAPIHostName}`
        }, {
            includeAllIntents: true
        }, true);

        const qnaMaker = new QnAMaker({
            knowledgeBaseId: process.env.QnAKnowledgebaseId,
            endpointKey: process.env.QnAEndpointKey,
            host: process.env.QnAEndpointHostName
        });

        this.qnaMaker = qnaMaker;


        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        this.onMessage(async (context, next) => {
            const luisResult = await dispatchRecognizer.recognize(context)
            const intent = LuisRecognizer.topIntent(luisResult);

            const entities = luisResult.entities;

            await this.dispatchToIntent(context, intent, entities);

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onDialog(async (context, next) => {
            await this.converstationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            await this.populateDefaultMessage(context);
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }

    async dispatchToIntent(context, intent, entities) {
        var currentIntent = "";
        const previousIntent = await this.previousIntent.get(context, {});
        const converstationData = await this.converstationData.get(context, {});

        if (previousIntent.intentName && converstationData.endDialog === false) {
            currentIntent = previousIntent.intentName;
        }
        else if (previousIntent.intentName && converstationData.endDialog === true) {
            currentIntent = context.intent;
        }
        else if(intent == "None" && !previousIntent.intentName)
        {
            var result = await this.qnaMaker.getAnswers(context)
            await context.sendActivity(`${ result[0].answer}`);
            await this.suggestActions(context);
        }
        else {
            currentIntent = intent;
            await this.previousIntent.set(context, { intentName: intent });
        }
        switch (currentIntent) {

            case "Add_Timesheets":
                await this.converstationData.set(context, { endDialog: false });
                await this.addTimesheetDialog.run(context, this.dialogState, entities);
                converstationData.endDialog = await this.addTimesheetDialog.isDialogComplete();
                if (converstationData.endDialog) {
                    await this.previousIntent.set(context, { intentName: null });
                    await this.suggestActions(context);
                }
                break;
            default:
                break;
        }
    }

    async populateDefaultMessage(turnContext) {
        const { activity } = turnContext;

        for (const idx in activity.membersAdded) {
            if (activity.membersAdded[idx].id !== activity.recipient.id) {
                const defaultMessage = `Hi ${activity.membersAdded[idx].name}, Welcome to Izanagi bot. `
                await turnContext.sendActivity(defaultMessage);
                await this.suggestActions(turnContext);
            }
        }
    }

    async suggestActions(turnContext) {
        var actionResponses = MessageFactory.suggestedActions(["Add Timesheets", "Take over the world", "I have a even better idea"], "Please choose options below of what you control over?");
        await turnContext.sendActivity(actionResponses);
    }

}

module.exports.TTBot = TTBot;
