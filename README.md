# HMCTS Dev Test Frontend

## Prerequisites
- Yarn 1.22.19 or newer (the required minimum for the webpack build)
- Node.js 20.11.1 or newer (the required minimum for the webpack build)

This will be the frontend for the brand new HMCTS case management system. As a potential candidate we are leaving
this in your hands. Please refer to the brief for the complete list of tasks! Complete as much as you can and be
as creative as you want.

To begin with, you should be able to run this by running:

1. `yarn install`
2. `yarn webpack`
3. `yarn start:dev` or navigate to package.json and run the script manually

You can change the structure however you like!

## Tests
To run the tests run the commands :
Unit tests : `yarn test:unit`
Route tests : `yarn test:routes`


## Main features
- **Browse tasks:** View each task's case number, title, description and status, with created and due dates shown in UK date and time format.
- **Filter and navigate:** Filter tasks by status and browse results 10 at a time. The selected filter is retained as you move between pages.
- **Create tasks:** Enter a case number, title and due date and time; a description is optional. New tasks start with an Open status.
- **Manage tasks:** Open a task to view its details, change its status or delete it.
- **Get feedback:** The interface shows empty states, success messages and errors.
